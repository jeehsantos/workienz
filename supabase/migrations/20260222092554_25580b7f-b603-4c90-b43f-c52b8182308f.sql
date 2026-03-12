
-- Create pre-employment packs table
CREATE TABLE public.application_pre_employment_packs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_application_id uuid NOT NULL UNIQUE REFERENCES public.job_applications(id) ON DELETE CASCADE,
  conversation_id uuid NULL,
  required_by_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'required',
  started_at timestamptz NULL,
  submitted_at timestamptz NULL,
  reviewed_at timestamptz NULL,
  answers jsonb NULL,
  pack_version text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_pre_employment_pack_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('required', 'in_progress', 'submitted', 'reviewed', 'waived', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid pre-employment pack status: %. Must be required, in_progress, submitted, reviewed, waived, or cancelled', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_pack_status
BEFORE INSERT OR UPDATE ON public.application_pre_employment_packs
FOR EACH ROW EXECUTE FUNCTION public.validate_pre_employment_pack_status();

-- Updated_at trigger
CREATE TRIGGER update_pre_employment_packs_updated_at
BEFORE UPDATE ON public.application_pre_employment_packs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.application_pre_employment_packs ENABLE ROW LEVEL SECURITY;

-- Employee can read their own pack (via job_application ownership)
CREATE POLICY "Employees can view own packs"
ON public.application_pre_employment_packs
FOR SELECT
USING (
  job_application_id IN (
    SELECT ja.id FROM public.job_applications ja
    JOIN public.employee_profiles ep ON ep.id = ja.employee_id
    WHERE ep.user_id = auth.uid()
  )
);

-- Employee can update their own pack (answers, status to in_progress/submitted)
CREATE POLICY "Employees can update own packs"
ON public.application_pre_employment_packs
FOR UPDATE
USING (
  job_application_id IN (
    SELECT ja.id FROM public.job_applications ja
    JOIN public.employee_profiles ep ON ep.id = ja.employee_id
    WHERE ep.user_id = auth.uid()
  )
);

-- Contractor can read packs for their jobs
CREATE POLICY "Contractors can view packs for own jobs"
ON public.application_pre_employment_packs
FOR SELECT
USING (
  job_application_id IN (
    SELECT ja.id FROM public.job_applications ja
    JOIN public.jobs j ON j.id = ja.job_id
    JOIN public.contractor_profiles cp ON cp.id = j.contractor_id
    WHERE cp.user_id = auth.uid()
  )
);

-- Contractor can update packs for their jobs (reviewed/waived)
CREATE POLICY "Contractors can update packs for own jobs"
ON public.application_pre_employment_packs
FOR UPDATE
USING (
  job_application_id IN (
    SELECT ja.id FROM public.job_applications ja
    JOIN public.jobs j ON j.id = ja.job_id
    JOIN public.contractor_profiles cp ON cp.id = j.contractor_id
    WHERE cp.user_id = auth.uid()
  )
);

-- Admin full access
CREATE POLICY "Admins can manage all packs"
ON public.application_pre_employment_packs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
