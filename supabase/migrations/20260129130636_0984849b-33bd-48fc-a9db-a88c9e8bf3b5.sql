-- Add hired_at column to track when a conversation was hired
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS hired_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient queries on hired_at
CREATE INDEX IF NOT EXISTS idx_conversations_hired_at ON public.conversations(hired_at) WHERE hired_at IS NOT NULL;

-- Create/update the cleanup function for scheduled conversation deletions
CREATE OR REPLACE FUNCTION public.cleanup_scheduled_conversations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- First, delete all messages for conversations scheduled for deletion
  DELETE FROM public.messages 
  WHERE conversation_id IN (
    SELECT id FROM public.conversations 
    WHERE scheduled_deletion_at IS NOT NULL 
      AND scheduled_deletion_at <= now()
  );
  
  -- Delete conversation read status entries
  DELETE FROM public.conversation_read_status
  WHERE conversation_id IN (
    SELECT id FROM public.conversations 
    WHERE scheduled_deletion_at IS NOT NULL 
      AND scheduled_deletion_at <= now()
  );
  
  -- Then delete the conversations themselves
  WITH deleted AS (
    DELETE FROM public.conversations
    WHERE scheduled_deletion_at IS NOT NULL
      AND scheduled_deletion_at <= now()
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_count FROM deleted;
  
  RETURN v_deleted_count;
END;
$$;