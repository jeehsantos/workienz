
-- Update the validation trigger to accept 'suspended' status
CREATE OR REPLACE FUNCTION public.validate_work_verification_status()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.work_verification_status NOT IN ('unverified', 'pending', 'verified', 'review_required', 'rejected', 'suspended') THEN
    RAISE EXCEPTION 'Invalid work_verification_status: %. Must be unverified, pending, verified, review_required, rejected, or suspended', NEW.work_verification_status;
  END IF;
  RETURN NEW;
END;
$function$;
