-- Allow authenticated users to upload to chat-attachments/ path in pre-employment-docs bucket
CREATE POLICY "Users can upload chat attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pre-employment-docs' AND
  (storage.foldername(name))[1] = 'chat-attachments'
);

-- Allow conversation participants to read/download chat attachment files
CREATE POLICY "Users can read chat attachments in their conversations"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'pre-employment-docs' AND
  (storage.foldername(name))[1] = 'chat-attachments'
);

-- Update cleanup function to also delete chat attachment files from storage
CREATE OR REPLACE FUNCTION public.cleanup_scheduled_conversations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted_count INTEGER;
  v_conv_ids uuid[];
BEGIN
  -- Collect conversation IDs that are due for deletion
  SELECT array_agg(id) INTO v_conv_ids
  FROM public.conversations
  WHERE scheduled_deletion_at IS NOT NULL
    AND scheduled_deletion_at <= now();

  IF v_conv_ids IS NULL OR array_length(v_conv_ids, 1) = 0 THEN
    RETURN 0;
  END IF;

  -- Delete chat attachment files from storage for these conversations
  DELETE FROM storage.objects
  WHERE bucket_id = 'pre-employment-docs'
    AND (storage.foldername(name))[1] = 'chat-attachments'
    AND (storage.foldername(name))[2] = ANY(
      SELECT unnest(v_conv_ids)::text
    );

  -- Delete all messages for conversations scheduled for deletion
  DELETE FROM public.messages
  WHERE conversation_id = ANY(v_conv_ids);

  -- Delete conversation read status entries
  DELETE FROM public.conversation_read_status
  WHERE conversation_id = ANY(v_conv_ids);

  -- Delete related pre-employment packs
  DELETE FROM public.application_pre_employment_packs
  WHERE job_application_id IN (
    SELECT job_application_id FROM public.conversations
    WHERE id = ANY(v_conv_ids)
    AND job_application_id IS NOT NULL
  );

  -- Then delete the conversations themselves
  WITH deleted AS (
    DELETE FROM public.conversations
    WHERE id = ANY(v_conv_ids)
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_count FROM deleted;

  RETURN v_deleted_count;
END;
$$;