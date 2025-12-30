-- Fix profiles table RLS: Only users can view their own profile OR related profiles (conversations, job applications)
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view conversation partner profiles" 
ON public.profiles FOR SELECT
USING (
  user_id IN (
    SELECT contractor_user_id FROM conversations WHERE employee_user_id = auth.uid()
    UNION
    SELECT employee_user_id FROM conversations WHERE contractor_user_id = auth.uid()
  )
);

CREATE POLICY "Contractors can view applicant profiles" 
ON public.profiles FOR SELECT
USING (
  user_id IN (
    SELECT ep.user_id FROM employee_profiles ep
    INNER JOIN job_applications ja ON ja.employee_id = ep.id
    INNER JOIN jobs j ON j.id = ja.job_id
    INNER JOIN contractor_profiles cp ON cp.id = j.contractor_id
    WHERE cp.user_id = auth.uid()
  )
);

CREATE POLICY "Employees can view job poster profiles" 
ON public.profiles FOR SELECT
USING (
  user_id IN (
    SELECT cp.user_id FROM contractor_profiles cp
    INNER JOIN jobs j ON j.contractor_id = cp.id
    WHERE j.status = 'published'
  )
);

-- Fix contractor_profiles table RLS: Only visible with published jobs or in conversations
DROP POLICY IF EXISTS "Anyone can view contractor profiles" ON public.contractor_profiles;

CREATE POLICY "View own contractor profile" 
ON public.contractor_profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "View contractors with published jobs" 
ON public.contractor_profiles FOR SELECT
USING (
  id IN (SELECT contractor_id FROM jobs WHERE status = 'published')
);

CREATE POLICY "View contractors in conversations" 
ON public.contractor_profiles FOR SELECT
USING (
  user_id IN (
    SELECT contractor_user_id FROM conversations WHERE employee_user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all contractor profiles" 
ON public.contractor_profiles FOR SELECT
USING (has_role(auth.uid(), 'admin'));