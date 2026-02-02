-- Add has_priority column to contractor_profiles for admin-controlled priority badge feature
ALTER TABLE public.contractor_profiles
ADD COLUMN has_priority boolean NOT NULL DEFAULT false;

-- Add index for efficient querying of priority contractors
CREATE INDEX idx_contractor_profiles_has_priority ON public.contractor_profiles (has_priority) WHERE has_priority = true;

-- Add comment for documentation
COMMENT ON COLUMN public.contractor_profiles.has_priority IS 'Admin-controlled flag to mark contractor jobs as priority, showing them at the top of job listings';