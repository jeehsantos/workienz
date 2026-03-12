CREATE POLICY "Contractors can insert packs for own jobs"
ON public.application_pre_employment_packs
FOR INSERT
TO authenticated
WITH CHECK (
  (required_by_user_id = auth.uid()) AND
  has_role(auth.uid(), 'contractor'::app_role) AND
  (job_application_id IN (
    SELECT ja.id
    FROM job_applications ja
    JOIN jobs j ON j.id = ja.job_id
    JOIN contractor_profiles cp ON cp.id = j.contractor_id
    WHERE cp.user_id = auth.uid()
  ))
);