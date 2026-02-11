-- Add 'private' to job_status enum
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'private';

-- Update RLS: private jobs should only be visible to the contractor who created them
-- The existing "Anyone can view published jobs" policy already filters by status = 'published'
-- so private jobs are automatically excluded from public view.
-- The "Contractors can view their own jobs" policy already covers contractor access.
-- No additional RLS changes needed.