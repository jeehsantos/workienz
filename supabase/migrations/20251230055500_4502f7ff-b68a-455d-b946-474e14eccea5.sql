-- Fix contractor profile update policy (remove unnecessary WITH CHECK)
DROP POLICY IF EXISTS "Contractors can update their own profile" ON public.contractor_profiles;
CREATE POLICY "Contractors can update their own profile" 
ON public.contractor_profiles 
FOR UPDATE 
USING ((auth.uid() = user_id) AND has_role(auth.uid(), 'contractor'::app_role));

-- Add admin policy to view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add admin policy to view all jobs
DROP POLICY IF EXISTS "Admins can view all jobs" ON public.jobs;
CREATE POLICY "Admins can view all jobs" 
ON public.jobs 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));