
-- 1. Add shift allocation mode to jobs (first_come = instant claim, contractor_select = request/approve)
ALTER TABLE public.jobs
ADD COLUMN shift_allocation_mode text NOT NULL DEFAULT 'first_come';

-- Validation trigger for shift_allocation_mode
CREATE OR REPLACE FUNCTION public.validate_shift_allocation_mode()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.shift_allocation_mode NOT IN ('first_come', 'contractor_select') THEN
    RAISE EXCEPTION 'Invalid shift_allocation_mode: %. Must be first_come or contractor_select', NEW.shift_allocation_mode;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_shift_allocation_mode
BEFORE INSERT OR UPDATE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.validate_shift_allocation_mode();

-- 2. Add capacity per shift (how many workers can be assigned/claimed)
ALTER TABLE public.job_shifts
ADD COLUMN capacity integer NOT NULL DEFAULT 1;

-- 3. Update shift assignment status trigger to include 'requested'
CREATE OR REPLACE FUNCTION public.validate_shift_assignment_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('requested', 'assigned', 'confirmed', 'declined', 'no_show', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid shift assignment status: %. Must be requested, assigned, confirmed, declined, no_show, completed, or cancelled', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Allow employees to INSERT shift assignments (for requesting/claiming)
CREATE POLICY "Employees can request shifts"
ON public.shift_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = employee_user_id
  AND has_role(auth.uid(), 'employee'::app_role)
);

-- 5. Atomic RPC for first_come shift claiming (prevents over-capacity)
CREATE OR REPLACE FUNCTION public.claim_shift_atomic(
  p_shift_id uuid,
  p_job_id uuid,
  p_employee_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_capacity integer;
  v_current_count integer;
  v_allocation_mode text;
  v_job_type text;
  v_job_status text;
  v_existing_id uuid;
  v_pool_member_id uuid;
  v_contractor_id uuid;
  v_new_id uuid;
BEGIN
  -- 1. Lock the shift row and get capacity
  SELECT js.capacity INTO v_capacity
  FROM public.job_shifts js
  WHERE js.id = p_shift_id AND js.job_id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SHIFT_NOT_FOUND');
  END IF;

  -- 2. Validate job is published shift job with first_come mode
  SELECT j.shift_allocation_mode, j.job_type, j.status, j.contractor_id
  INTO v_allocation_mode, v_job_type, v_job_status, v_contractor_id
  FROM public.jobs j
  WHERE j.id = p_job_id;

  IF v_job_status != 'published' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'JOB_NOT_OPEN');
  END IF;

  IF v_job_type != 'shift' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_SHIFT_JOB');
  END IF;

  IF v_allocation_mode != 'first_come' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'WRONG_MODE');
  END IF;

  -- 3. Verify employee is in the talent pool for this contractor
  SELECT ctpm.id INTO v_pool_member_id
  FROM public.contractor_talent_pool_members ctpm
  JOIN public.contractor_profiles cp ON cp.user_id = ctpm.contractor_id
  WHERE cp.id = v_contractor_id
    AND ctpm.employee_id = p_employee_user_id
    AND ctpm.status = 'active'
  LIMIT 1;

  IF v_pool_member_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_IN_POOL');
  END IF;

  -- 4. Check for duplicate
  SELECT sa.id INTO v_existing_id
  FROM public.shift_assignments sa
  WHERE sa.shift_id = p_shift_id AND sa.employee_user_id = p_employee_user_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_CLAIMED');
  END IF;

  -- 5. Check capacity
  SELECT COUNT(*) INTO v_current_count
  FROM public.shift_assignments sa
  WHERE sa.shift_id = p_shift_id AND sa.status IN ('confirmed', 'assigned');

  IF v_current_count >= v_capacity THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SHIFT_FULL');
  END IF;

  -- 6. Insert as confirmed (first_come = instant)
  INSERT INTO public.shift_assignments (
    shift_id, job_id, employee_user_id, assigned_by, status
  ) VALUES (
    p_shift_id, p_job_id, p_employee_user_id, p_employee_user_id, 'confirmed'
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'CLAIMED',
    'assignment_id', v_new_id
  );
END;
$$;

-- 6. Atomic RPC for contractor_select shift requesting
CREATE OR REPLACE FUNCTION public.request_shift_atomic(
  p_shift_id uuid,
  p_job_id uuid,
  p_employee_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_allocation_mode text;
  v_job_type text;
  v_job_status text;
  v_contractor_id uuid;
  v_existing_id uuid;
  v_pool_member_id uuid;
  v_new_id uuid;
BEGIN
  -- 1. Validate job
  SELECT j.shift_allocation_mode, j.job_type, j.status, j.contractor_id
  INTO v_allocation_mode, v_job_type, v_job_status, v_contractor_id
  FROM public.jobs j
  WHERE j.id = p_job_id;

  IF NOT FOUND OR v_job_status != 'published' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'JOB_NOT_OPEN');
  END IF;

  IF v_job_type != 'shift' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_SHIFT_JOB');
  END IF;

  IF v_allocation_mode != 'contractor_select' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'WRONG_MODE');
  END IF;

  -- 2. Verify shift exists
  PERFORM 1 FROM public.job_shifts WHERE id = p_shift_id AND job_id = p_job_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SHIFT_NOT_FOUND');
  END IF;

  -- 3. Verify employee is in talent pool
  SELECT ctpm.id INTO v_pool_member_id
  FROM public.contractor_talent_pool_members ctpm
  JOIN public.contractor_profiles cp ON cp.user_id = ctpm.contractor_id
  WHERE cp.id = v_contractor_id
    AND ctpm.employee_id = p_employee_user_id
    AND ctpm.status = 'active'
  LIMIT 1;

  IF v_pool_member_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_IN_POOL');
  END IF;

  -- 4. Check duplicate
  SELECT sa.id INTO v_existing_id
  FROM public.shift_assignments sa
  WHERE sa.shift_id = p_shift_id AND sa.employee_user_id = p_employee_user_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_REQUESTED');
  END IF;

  -- 5. Insert as requested (awaiting contractor approval)
  INSERT INTO public.shift_assignments (
    shift_id, job_id, employee_user_id, assigned_by, status
  ) VALUES (
    p_shift_id, p_job_id, p_employee_user_id, p_employee_user_id, 'requested'
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'REQUESTED',
    'assignment_id', v_new_id
  );
END;
$$;
