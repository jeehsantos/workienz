-- Allow writers to delete their own articles
CREATE POLICY "Writers can delete their own articles"
ON public.articles
FOR DELETE
USING ((author_id = auth.uid()) AND has_role(auth.uid(), 'writer'::app_role));

-- Allow admins to delete any article
CREATE POLICY "Admins can delete any article"
ON public.articles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Also allow admins to view all articles (for management purposes)
CREATE POLICY "Admins can view all articles"
ON public.articles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update any article
CREATE POLICY "Admins can update any article"
ON public.articles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));