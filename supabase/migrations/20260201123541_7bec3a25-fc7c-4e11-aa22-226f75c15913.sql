-- Add avatar_url column to contractor_profiles for company logo
ALTER TABLE public.contractor_profiles
ADD COLUMN avatar_url TEXT;

-- Create storage bucket for contractor logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('contractor-logos', 'contractor-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for contractor-logos bucket
-- Anyone can view (public bucket)
CREATE POLICY "Public can view contractor logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'contractor-logos');

-- Contractors can upload their own logo
CREATE POLICY "Contractors can upload their logo"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'contractor-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND has_role(auth.uid(), 'contractor'::app_role)
);

-- Contractors can update their own logo
CREATE POLICY "Contractors can update their logo"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'contractor-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND has_role(auth.uid(), 'contractor'::app_role)
);

-- Contractors can delete their own logo
CREATE POLICY "Contractors can delete their logo"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'contractor-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND has_role(auth.uid(), 'contractor'::app_role)
);