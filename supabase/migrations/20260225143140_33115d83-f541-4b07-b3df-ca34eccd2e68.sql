
-- Storage bucket for pre-employment documents (PDF/DOC)
INSERT INTO storage.buckets (id, name, public)
VALUES ('pre-employment-docs', 'pre-employment-docs', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Contractors can upload their own docs
CREATE POLICY "Contractors can upload pre-employment docs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'pre-employment-docs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS: Contractors can update their own docs
CREATE POLICY "Contractors can update pre-employment docs"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'pre-employment-docs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS: Contractors can delete their own docs
CREATE POLICY "Contractors can delete pre-employment docs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'pre-employment-docs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS: Authenticated users can download (employees need access after hire)
CREATE POLICY "Authenticated users can download pre-employment docs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'pre-employment-docs'
  AND auth.role() = 'authenticated'
);

-- Add file reference columns to contractor_profiles
ALTER TABLE public.contractor_profiles
  ADD COLUMN IF NOT EXISTS pre_employment_file_url text,
  ADD COLUMN IF NOT EXISTS pre_employment_file_name text;
