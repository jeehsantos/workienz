
-- Step 1A: Migrate existing job_type values based on schedule_type
-- All existing jobs with schedule_type='shifts' become job_type='shift', rest become 'normal'
UPDATE public.jobs
SET job_type = CASE 
  WHEN schedule_type = 'shifts' THEN 'shift'
  ELSE 'normal'
END;

-- Set default for future inserts
ALTER TABLE public.jobs ALTER COLUMN job_type SET DEFAULT 'normal';

-- Step 1C: Add validation trigger for application status rules
CREATE OR REPLACE FUNCTION public.validate_application_status_by_job_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_job_type text;
BEGIN
  -- Look up the job_type for this application's job
  SELECT j.job_type INTO v_job_type
  FROM public.jobs j
  WHERE j.id = NEW.job_id;

  -- Normal jobs cannot have 'approved_to_pool' status
  IF v_job_type = 'normal' AND NEW.status = 'approved_to_pool' THEN
    RAISE EXCEPTION 'Cannot set status to approved_to_pool for normal (fixed term) jobs';
  END IF;

  -- Shift jobs cannot have 'hired' status (hiring happens via shifts, not directly)
  IF v_job_type = 'shift' AND NEW.status = 'hired' THEN
    RAISE EXCEPTION 'Cannot set status to hired for shift jobs. Use approved_to_pool instead.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_application_status_by_job_type
BEFORE INSERT OR UPDATE OF status ON public.job_applications
FOR EACH ROW
EXECUTE FUNCTION public.validate_application_status_by_job_type();
