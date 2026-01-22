-- Add new columns to employee_profiles table for Formal CV enhancement
ALTER TABLE public.employee_profiles
ADD COLUMN IF NOT EXISTS enable_formal_cv boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS work_experience jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS education jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS cv_references jsonb DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.employee_profiles.enable_formal_cv IS 'Toggle to enable formal CV fields';
COMMENT ON COLUMN public.employee_profiles.work_experience IS 'Array of work experience objects {company, position, description, start_date, end_date, current}';
COMMENT ON COLUMN public.employee_profiles.education IS 'Array of education objects {institution, degree, field, start_year, end_year, current}';
COMMENT ON COLUMN public.employee_profiles.cv_references IS 'Array of reference objects {name, position, company, email, phone}';