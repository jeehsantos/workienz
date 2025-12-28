-- Add experience_required toggle to jobs table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS experience_required boolean DEFAULT false;

-- Add new fields to employee_profiles: bio, languages, date_of_birth, visa_status
ALTER TABLE public.employee_profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.employee_profiles ADD COLUMN IF NOT EXISTS languages text[];
ALTER TABLE public.employee_profiles ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.employee_profiles ADD COLUMN IF NOT EXISTS visa_status text;

-- Drop the hourly_rate columns from employee_profiles (user requested removal)
ALTER TABLE public.employee_profiles DROP COLUMN IF EXISTS hourly_rate_min;
ALTER TABLE public.employee_profiles DROP COLUMN IF EXISTS hourly_rate_max;