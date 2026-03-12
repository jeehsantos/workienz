
-- Step 4: Create user_work_verification_requests table
CREATE TABLE IF NOT EXISTS public.user_work_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  declared_status text NOT NULL,
  document_path text NOT NULL,
  extracted_data jsonb NULL,
  ai_confidence numeric NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_review_notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz NULL,
  reviewed_by uuid NULL
);

-- Validation trigger for declared_status
CREATE OR REPLACE FUNCTION public.validate_verification_request_status()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.declared_status NOT IN ('nz_citizen', 'resident', 'work_visa', 'student_visa') THEN
    RAISE EXCEPTION 'Invalid declared_status: %. Must be nz_citizen, resident, work_visa, or student_visa', NEW.declared_status;
  END IF;
  IF NEW.status NOT IN ('pending', 'verified', 'review_required', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: %. Must be pending, verified, review_required, or rejected', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_verification_request ON public.user_work_verification_requests;
CREATE TRIGGER trg_validate_verification_request
  BEFORE INSERT OR UPDATE ON public.user_work_verification_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_verification_request_status();

-- Auto-update updated_at
DROP TRIGGER IF EXISTS trg_update_verification_request_updated_at ON public.user_work_verification_requests;
CREATE TRIGGER trg_update_verification_request_updated_at
  BEFORE UPDATE ON public.user_work_verification_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_verification_requests_user_id ON public.user_work_verification_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON public.user_work_verification_requests (status);
CREATE INDEX IF NOT EXISTS idx_verification_requests_created_at ON public.user_work_verification_requests (created_at DESC);

-- Enable RLS
ALTER TABLE public.user_work_verification_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own verification requests"
ON public.user_work_verification_requests FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own verification requests"
ON public.user_work_verification_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all verification requests"
ON public.user_work_verification_requests FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all verification requests"
ON public.user_work_verification_requests FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete verification requests"
ON public.user_work_verification_requests FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
