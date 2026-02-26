-- Add missing indexes for application enforcement queries
CREATE INDEX IF NOT EXISTS idx_job_applications_employee_id ON public.job_applications (employee_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON public.job_applications (status);
CREATE INDEX IF NOT EXISTS idx_job_applications_employee_status ON public.job_applications (employee_id, status);