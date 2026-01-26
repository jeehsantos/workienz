-- Create table to track job deletion reasons
CREATE TABLE public.job_deletion_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  job_title text NOT NULL,
  contractor_user_id uuid NOT NULL,
  deletion_reason text NOT NULL,
  custom_reason text,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_deletion_tracking ENABLE ROW LEVEL SECURITY;

-- Admins can view all deletion records
CREATE POLICY "Admins can view all deletion records"
ON public.job_deletion_tracking
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Contractors can view their own deletion records
CREATE POLICY "Contractors can view own deletion records"
ON public.job_deletion_tracking
FOR SELECT
USING (auth.uid() = contractor_user_id);

-- Contractors can insert deletion records for their jobs
CREATE POLICY "Contractors can insert deletion records"
ON public.job_deletion_tracking
FOR INSERT
WITH CHECK (auth.uid() = contractor_user_id);