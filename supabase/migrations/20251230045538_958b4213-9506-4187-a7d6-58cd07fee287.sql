-- Fix infinite recursion in contractor_profiles policies
-- The issue is that "View contractors with published jobs" references jobs, 
-- and jobs policies reference contractor_profiles, creating a loop

-- Drop the problematic policy
DROP POLICY IF EXISTS "View contractors with published jobs" ON contractor_profiles;

-- Create a simpler policy that doesn't cause recursion
-- Anyone can view verified contractors (those who have at least one published job)
CREATE POLICY "Public can view contractors with jobs"
ON contractor_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM jobs 
    WHERE jobs.contractor_id = contractor_profiles.id 
    AND jobs.status = 'published'::job_status
  )
);

-- Also need to ensure the jobs policy doesn't cause recursion with contractor_profiles
-- The "Contractors can view their own jobs" policy is fine because it only checks user_id

-- Let's ensure published jobs can be viewed without recursion
DROP POLICY IF EXISTS "Anyone can view published jobs" ON jobs;

CREATE POLICY "Anyone can view published jobs"
ON jobs
FOR SELECT
USING (status = 'published'::job_status);