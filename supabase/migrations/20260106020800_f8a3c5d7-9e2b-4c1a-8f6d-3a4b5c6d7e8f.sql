-- Add new columns to jobs table for requirements and benefits
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS requires_heavy_lifting boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_standing boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_car boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS provides_training boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS provides_accommodation boolean DEFAULT false;

-- Add new columns to employee_profiles table for preferences
ALTER TABLE employee_profiles
ADD COLUMN IF NOT EXISTS comfortable_heavy_lifting boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS comfortable_standing boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS has_car boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS has_ird_number boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN jobs.requires_heavy_lifting IS 'Job requires lifting > 10kg';
COMMENT ON COLUMN jobs.requires_standing IS 'Job requires standing for long periods';
COMMENT ON COLUMN jobs.requires_car IS 'Job requires worker to have a car';
COMMENT ON COLUMN jobs.provides_training IS 'Employer provides training';
COMMENT ON COLUMN jobs.provides_accommodation IS 'Employer provides accommodation';

COMMENT ON COLUMN employee_profiles.comfortable_heavy_lifting IS 'Worker is comfortable with heavy lifting (>10kg)';
COMMENT ON COLUMN employee_profiles.comfortable_standing IS 'Worker is comfortable standing for long periods';
COMMENT ON COLUMN employee_profiles.has_car IS 'Worker has access to a car';
COMMENT ON COLUMN employee_profiles.has_ird_number IS 'Worker has an IRD number';
