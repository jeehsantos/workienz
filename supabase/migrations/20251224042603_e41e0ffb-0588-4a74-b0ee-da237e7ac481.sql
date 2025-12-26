-- Add positions_available column to jobs table
ALTER TABLE public.jobs 
ADD COLUMN positions_available integer NOT NULL DEFAULT 1,
ADD COLUMN positions_filled integer NOT NULL DEFAULT 0;

-- Create storage bucket for article images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('article-images', 'article-images', true);

-- Storage policy: Anyone can view article images
CREATE POLICY "Anyone can view article images"
ON storage.objects FOR SELECT
USING (bucket_id = 'article-images');

-- Storage policy: Writers can upload article images
CREATE POLICY "Writers can upload article images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'article-images' 
  AND auth.uid() IS NOT NULL 
  AND public.has_role(auth.uid(), 'writer')
);

-- Storage policy: Writers can update their own images
CREATE POLICY "Writers can update article images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'article-images' 
  AND auth.uid() IS NOT NULL 
  AND public.has_role(auth.uid(), 'writer')
);

-- Storage policy: Writers can delete their own images
CREATE POLICY "Writers can delete article images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'article-images' 
  AND auth.uid() IS NOT NULL 
  AND public.has_role(auth.uid(), 'writer')
);