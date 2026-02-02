-- Drop the existing insert policy for writers
DROP POLICY IF EXISTS "Writers can insert articles" ON public.articles;

-- Create a new policy that allows both writers and admins to insert articles
CREATE POLICY "Writers and admins can insert articles" 
ON public.articles 
FOR INSERT 
WITH CHECK (
  (author_id = auth.uid()) AND 
  (has_role(auth.uid(), 'writer'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);