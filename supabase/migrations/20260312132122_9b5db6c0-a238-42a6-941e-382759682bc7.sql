
-- Step 2: Add work verification fields to employee_profiles
ALTER TABLE public.employee_profiles
  ADD COLUMN IF NOT EXISTS work_verification_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS work_verification_type text NULL,
  ADD COLUMN IF NOT EXISTS work_verification_date timestamptz NULL,
  ADD COLUMN IF NOT EXISTS work_verification_expiry_date timestamptz NULL,
  ADD COLUMN IF NOT EXISTS verification_review_reason text NULL;

-- Validation trigger for work_verification_status
CREATE OR REPLACE FUNCTION public.validate_work_verification_status()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.work_verification_status NOT IN ('unverified', 'pending', 'verified', 'review_required', 'rejected') THEN
    RAISE EXCEPTION 'Invalid work_verification_status: %. Must be unverified, pending, verified, review_required, or rejected', NEW.work_verification_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_work_verification_status ON public.employee_profiles;
CREATE TRIGGER trg_validate_work_verification_status
  BEFORE INSERT OR UPDATE ON public.employee_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_work_verification_status();

-- Index for quick lookups by verification status
CREATE INDEX IF NOT EXISTS idx_employee_profiles_work_verification_status
  ON public.employee_profiles (work_verification_status);
