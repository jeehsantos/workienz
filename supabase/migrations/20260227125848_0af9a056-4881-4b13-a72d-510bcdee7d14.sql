
-- Atomic hire transaction: sets hired, rejects others, updates availability, returns context
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

  -- 6. Update worker availability
  UPDATE public.employee_profiles
  SET is_available = false, updated_at = now()
  WHERE id = v_app.employee_id;

  -- 7. Get the conversation for this application
  SELECT id INTO v_conversation_id
  FROM public.conversations
  WHERE job_application_id = p_application_id
  LIMIT 1;

  -- 8. Update hired conversation with 48h deletion schedule
  IF v_conversation_id IS NOT NULL THEN
    UPDATE public.conversations
    SET hired_at = now(),
        scheduled_deletion_at = now() + interval '48 hours'
    WHERE id = v_conversation_id;
  END IF;

  -- 9. Batch reject all other pending/reviewing applications for this employee
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

  -- 10. Batch close and schedule deletion for rejected conversations
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

  -- Return all context needed for post-transaction side effects (messages, notifications)
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
