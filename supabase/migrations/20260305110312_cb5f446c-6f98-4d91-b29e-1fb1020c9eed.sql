-- Allow talent pool members to see shift assignments for published jobs they're pooled into
-- This enables accurate filled/capacity counts in the employee shift browser
CREATE POLICY "Pool members can view shift assignments for pooled jobs"
ON public.shift_assignments FOR SELECT
TO authenticated
USING (
  job_id IN (
    SELECT j.id
    FROM public.jobs j
    JOIN public.contractor_talent_pool_members ctpm 
      ON ctpm.contractor_id = (
        SELECT cp.user_id FROM public.contractor_profiles cp WHERE cp.id = j.contractor_id
      )
    WHERE j.status = 'published'
      AND j.job_type = 'shift'
      AND ctpm.employee_id = auth.uid()
      AND ctpm.status = 'active'
  )
);