
-- ============================================================
-- PHASE 4: positions_filled hire-centric + max_applications
-- PHASE 6: auto-favorite on hire + favorite boost index
-- ============================================================

-- 1. Drop triggers that increment positions_filled on application insert
--    and adjust on application status change (these conflict with hire-centric semantics)
DROP TRIGGER IF EXISTS increment_positions_on_apply ON public.job_applications;
DROP TRIGGER IF EXISTS handle_application_status ON public.job_applications;
DROP TRIGGER IF EXISTS on_application_insert ON public.job_applications;

-- 2. Add max_applications column to jobs (nullable = no cap)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS max_applications integer DEFAULT NULL;

-- 3. Add index for favorite boost lookups (Phase 6 Task 8)
CREATE INDEX IF NOT EXISTS idx_contractor_favorite_workers_lookup 
  ON public.contractor_favorite_workers(contractor_user_id, employee_profile_id);

-- 4. Add composite index for AI scoring queries (Phase 3 confirmation)
CREATE INDEX IF NOT EXISTS idx_job_applications_ai_ranking 
  ON public.job_applications(job_id, ai_scoring_status, status, ai_score DESC, created_at ASC);

-- 5. Update create_job_application_atomic to enforce max_applications
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
  v_max_apps integer;
  v_current_app_count integer;
  v_existing_id uuid;
  v_new_id uuid;
BEGIN
  -- 1. Lock the job row and check status + slots
  SELECT positions_available, positions_filled, status, max_applications
  INTO v_available, v_filled, v_job_status, v_max_apps
  FROM public.jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('code', 'JOB_NOT_FOUND', 'ok', false);
  END IF;

  IF v_job_status != 'published' THEN
    RETURN jsonb_build_object('code', 'JOB_NOT_OPEN', 'ok', false);
  END IF;

  -- positions_filled is now hire-centric, so check against positions_available
  IF v_filled >= v_available THEN
    RETURN jsonb_build_object('code', 'NO_SLOTS', 'ok', false);
  END IF;

  -- 2. Check max_applications cap (if set)
  IF v_max_apps IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_app_count
    FROM public.job_applications
    WHERE job_id = p_job_id;

    IF v_current_app_count >= v_max_apps THEN
      RETURN jsonb_build_object('code', 'APPLICATIONS_CLOSED', 'ok', false);
    END IF;
  END IF;

  -- 3. Check for duplicate application
  SELECT id INTO v_existing_id
  FROM public.job_applications
  WHERE job_id = p_job_id AND employee_id = p_employee_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('code', 'ALREADY_APPLIED', 'ok', false);
  END IF;

  -- 4. Insert the application (NO positions_filled increment — hire-centric only)
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

  RETURN jsonb_build_object(
    'code', 'OK',
    'ok', true,
    'application_id', v_new_id
  );
END;
$function$;

-- 6. Update execute_hire_transaction to:
--    a) Increment positions_filled on hire
--    b) Auto-favorite the hired worker (Phase 6 Task 7)
CREATE OR REPLACE FUNCTION public.execute_hire_transaction(
  p_application_id uuid,
  p_contractor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_app RECORD;
  v_job RECORD;
  v_contractor RECORD;
  v_employee RECORD;
  v_employee_name text;
  v_conversation_id uuid;
  v_rejected_app_ids uuid[];
  v_rejected_conversation_ids uuid[];
  v_rejected_job_ids uuid[];
BEGIN
  -- 1. Fetch application
  SELECT id, job_id, employee_id, status
  INTO v_app
  FROM public.job_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'APP_NOT_FOUND');
  END IF;

  IF v_app.status = 'hired' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_HIRED');
  END IF;

  -- 2. Fetch job and lock it
  SELECT id, title, contractor_id
  INTO v_job
  FROM public.jobs
  WHERE id = v_app.job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'JOB_NOT_FOUND');
  END IF;

  -- 3. Verify contractor ownership
  SELECT id, user_id
  INTO v_contractor
  FROM public.contractor_profiles
  WHERE id = v_job.contractor_id;

  IF NOT FOUND OR v_contractor.user_id != p_contractor_user_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED');
  END IF;

  -- 4. Fetch employee
  SELECT ep.id, ep.user_id
  INTO v_employee
  FROM public.employee_profiles ep
  WHERE ep.id = v_app.employee_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'EMPLOYEE_NOT_FOUND');
  END IF;

  -- Get employee name
  SELECT COALESCE(full_name, 'Applicant')
  INTO v_employee_name
  FROM public.profiles
  WHERE user_id = v_employee.user_id;

  -- 5. Set application status to hired
  UPDATE public.job_applications
  SET status = 'hired', updated_at = now()
  WHERE id = p_application_id;

  -- 6. INCREMENT positions_filled (hire-centric: only changes on actual hire)
  UPDATE public.jobs
  SET positions_filled = positions_filled + 1, updated_at = now()
  WHERE id = v_job.id;

  -- 7. Update worker availability
  UPDATE public.employee_profiles
  SET is_available = false, updated_at = now()
  WHERE id = v_app.employee_id;

  -- 8. Get the conversation for this application
  SELECT id INTO v_conversation_id
  FROM public.conversations
  WHERE job_application_id = p_application_id
  LIMIT 1;

  -- 9. Update hired conversation with 48h deletion schedule
  IF v_conversation_id IS NOT NULL THEN
    UPDATE public.conversations
    SET hired_at = now(),
        scheduled_deletion_at = now() + interval '48 hours'
    WHERE id = v_conversation_id;
  END IF;

  -- 10. Batch reject all other pending/reviewing applications for this employee
  WITH rejected AS (
    UPDATE public.job_applications
    SET status = 'rejected', updated_at = now()
    WHERE employee_id = v_app.employee_id
      AND id != p_application_id
      AND status IN ('pending', 'reviewing', 'shortlisted')
    RETURNING id, job_id
  )
  SELECT
    array_agg(r.id),
    array_agg(r.job_id)
  INTO v_rejected_app_ids, v_rejected_job_ids
  FROM rejected r;

  -- 11. Batch close and schedule deletion for rejected conversations
  IF v_rejected_app_ids IS NOT NULL AND array_length(v_rejected_app_ids, 1) > 0 THEN
    WITH closed_convs AS (
      UPDATE public.conversations
      SET status = 'closed',
          scheduled_deletion_at = now() + interval '48 hours'
      WHERE job_application_id = ANY(v_rejected_app_ids)
        AND status = 'active'
      RETURNING id
    )
    SELECT array_agg(id) INTO v_rejected_conversation_ids FROM closed_convs;
  END IF;

  -- 12. AUTO-FAVORITE: add hired worker to contractor's favorites (Phase 6 Task 7)
  INSERT INTO public.contractor_favorite_workers (
    contractor_user_id,
    employee_user_id,
    employee_profile_id,
    job_id,
    note
  ) VALUES (
    p_contractor_user_id,
    v_employee.user_id,
    v_app.employee_id,
    v_job.id,
    'Auto-favorited on hire'
  ) ON CONFLICT DO NOTHING;

  -- Return all context needed for post-transaction side effects
  RETURN jsonb_build_object(
    'ok', true,
    'code', 'HIRED',
    'application_id', p_application_id,
    'job_id', v_job.id,
    'job_title', v_job.title,
    'employee_id', v_app.employee_id,
    'employee_user_id', v_employee.user_id,
    'employee_name', v_employee_name,
    'contractor_user_id', p_contractor_user_id,
    'conversation_id', v_conversation_id,
    'rejected_app_ids', COALESCE(to_jsonb(v_rejected_app_ids), '[]'::jsonb),
    'rejected_job_ids', COALESCE(to_jsonb(v_rejected_job_ids), '[]'::jsonb),
    'rejected_conversation_ids', COALESCE(to_jsonb(v_rejected_conversation_ids), '[]'::jsonb)
  );
END;
$function$;

-- 7. Add unique constraint for auto-favorite ON CONFLICT to work
CREATE UNIQUE INDEX IF NOT EXISTS idx_contractor_favorite_unique 
  ON public.contractor_favorite_workers(contractor_user_id, employee_profile_id);

-- 8. Insert platform settings for AI usage caps (Phase 8)
INSERT INTO public.platform_settings (setting_key, setting_value, description)
VALUES 
  ('ai_questionnaire_cap_free', '5', 'Max questionnaire generations per month for free tier contractors'),
  ('ai_questionnaire_cap_paid', '100', 'Max questionnaire generations per month for paid tier contractors'),
  ('ai_scoring_cap_free', '50', 'Max application scorings per month for free tier contractors'),
  ('ai_scoring_cap_paid', '500', 'Max application scorings per month for paid tier contractors')
ON CONFLICT (setting_key) DO NOTHING;
