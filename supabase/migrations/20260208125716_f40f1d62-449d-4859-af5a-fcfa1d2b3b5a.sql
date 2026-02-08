
-- Atomic function to check if a job has available positions for new applications
-- This considers both filled positions AND pending/shortlisted applications
CREATE OR REPLACE FUNCTION public.check_job_application_slot(p_job_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available INT;
  v_filled INT;
  v_pending_apps INT;
BEGIN
  -- Lock the job row to prevent race conditions
  SELECT positions_available, positions_filled
  INTO v_available, v_filled
  FROM public.jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Count pending/shortlisted applications (not yet hired or rejected)
  SELECT COUNT(*)
  INTO v_pending_apps
  FROM public.job_applications
  WHERE job_id = p_job_id
    AND status IN ('pending', 'shortlisted');

  -- Check if there's room: total taken slots (filled + pending) must be less than available
  RETURN (v_filled + v_pending_apps) < v_available;
END;
$$;
