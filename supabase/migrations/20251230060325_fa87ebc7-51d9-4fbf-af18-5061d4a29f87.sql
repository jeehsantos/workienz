-- Fix infinite recursion in contractor_profiles RLS by removing direct jobs subquery

-- Helper function (SECURITY DEFINER) to check published jobs without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.contractor_has_published_jobs(_contractor_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs
    WHERE contractor_id = _contractor_profile_id
      AND status = 'published'::job_status
  );
$$;

-- Replace policy that caused recursion
DROP POLICY IF EXISTS "Public can view contractors with jobs" ON public.contractor_profiles;
CREATE POLICY "Public can view contractors with jobs"
ON public.contractor_profiles
FOR SELECT
USING (public.contractor_has_published_jobs(id));