
-- Step 3: Create private storage bucket for verification documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'verification-temp',
  'verification-temp',
  false,
  5242880, -- 5MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users can upload their own verification docs
CREATE POLICY "Users can upload own verification docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'verification-temp'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can view their own docs
CREATE POLICY "Users can view own verification docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-temp'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own docs
CREATE POLICY "Users can delete own verification docs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'verification-temp'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins can view all verification docs
CREATE POLICY "Admins can view all verification docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-temp'
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Admins can delete all verification docs
CREATE POLICY "Admins can delete all verification docs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'verification-temp'
  AND has_role(auth.uid(), 'admin'::app_role)
);
