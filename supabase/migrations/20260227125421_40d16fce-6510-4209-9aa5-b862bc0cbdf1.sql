
-- Create atomic job application function that locks, checks, and inserts in one transaction
CREATE OR REPLACE FUNCTION public.create_job_application_atomic(
  p_job_id uuid,
  p_employee_id uuid,
  p_cover_letter text DEFAULT NULL,
  p_application_answers jsonb DEFAULT NULL,
  p_ai_scoring_status text DEFAULT 'pending'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_available INT;
  v_filled INT;
  v_job_status text;
  v_existing_id uuid;
  v_new_id uuid;
BEGIN
  -- 1. Lock the job row and check status + slots
  SELECT positions_available, positions_filled, status
  INTO v_available, v_filled, v_job_status
  FROM public.jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('code', 'JOB_NOT_FOUND', 'ok', false);
  END IF;

  IF v_job_status != 'published' THEN
    RETURN jsonb_build_object('code', 'JOB_NOT_OPEN', 'ok', false);
  END IF;

  IF v_filled >= v_available THEN
    RETURN jsonb_build_object('code', 'NO_SLOTS', 'ok', false);
  END IF;

  -- 2. Check for duplicate application (under same lock scope)
  SELECT id INTO v_existing_id
  FROM public.job_applications
  WHERE job_id = p_job_id AND employee_id = p_employee_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('code', 'ALREADY_APPLIED', 'ok', false);
  END IF;

  -- 3. Insert the application
  INSERT INTO public.job_applications (
    job_id,
    employee_id,
    cover_letter,
    application_answers,
    ai_scoring_status
  ) VALUES (
    p_job_id,
    p_employee_id,
    p_cover_letter,
    p_application_answers,
    p_ai_scoring_status
  )
  RETURNING id INTO v_new_id;

  -- 4. Return success with application ID
  RETURN jsonb_build_object(
    'code', 'OK',
    'ok', true,
    'application_id', v_new_id
  );
END;
$function$;
