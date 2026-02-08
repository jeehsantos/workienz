
-- Fix: positions_filled already tracks applications via trigger, so just check that
CREATE OR REPLACE FUNCTION public.check_job_application_slot(p_job_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available INT;
  v_filled INT;
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

  -- positions_filled is already incremented by trigger on application insert,
  -- so we just check if there's room for one more
  RETURN v_filled < v_available;
END;
$$;
