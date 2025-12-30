-- Update the article-images bucket with file type and size restrictions
UPDATE storage.buckets 
SET 
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  file_size_limit = 5242880
WHERE id = 'article-images';