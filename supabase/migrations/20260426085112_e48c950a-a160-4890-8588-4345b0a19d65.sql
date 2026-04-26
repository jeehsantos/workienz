
ALTER TABLE public.contractor_profiles
  ADD COLUMN IF NOT EXISTS nzbn TEXT,
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nzbn_data JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contractor_profiles_nzbn_unique
  ON public.contractor_profiles(nzbn) WHERE nzbn IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contractor_profiles_verification_status
  ON public.contractor_profiles(verification_status);

CREATE OR REPLACE FUNCTION public.validate_contractor_verification_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.verification_status NOT IN ('unverified', 'verified', 'rejected') THEN
    RAISE EXCEPTION 'Invalid verification_status: %. Must be unverified, verified, or rejected', NEW.verification_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_contractor_verification_status_trigger ON public.contractor_profiles;
CREATE TRIGGER validate_contractor_verification_status_trigger
  BEFORE INSERT OR UPDATE OF verification_status ON public.contractor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_contractor_verification_status();
