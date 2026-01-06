-- Add physical requirement columns to jobs table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS requires_heavy_lifting boolean DEFAULT false;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS requires_standing boolean DEFAULT false;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS requires_car boolean DEFAULT false;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS provides_training boolean DEFAULT false;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS provides_accommodation boolean DEFAULT false;

-- Add employee profile columns
ALTER TABLE public.employee_profiles ADD COLUMN IF NOT EXISTS comfortable_heavy_lifting boolean DEFAULT false;
ALTER TABLE public.employee_profiles ADD COLUMN IF NOT EXISTS comfortable_standing boolean DEFAULT false;
ALTER TABLE public.employee_profiles ADD COLUMN IF NOT EXISTS has_car boolean DEFAULT false;
ALTER TABLE public.employee_profiles ADD COLUMN IF NOT EXISTS has_ird_number boolean DEFAULT false;
ALTER TABLE public.employee_profiles ADD COLUMN IF NOT EXISTS ird_number text;
ALTER TABLE public.employee_profiles ADD COLUMN IF NOT EXISTS location_region text;