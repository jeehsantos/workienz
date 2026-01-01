-- Create conversation_read_status table for tracking unread messages
CREATE TABLE public.conversation_read_status (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_read_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

-- Enable RLS
ALTER TABLE public.conversation_read_status ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own read status"
ON public.conversation_read_status FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own read status"
ON public.conversation_read_status FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own read status"
ON public.conversation_read_status FOR UPDATE
USING (auth.uid() = user_id);

-- Function to get unread message count for a user
CREATE OR REPLACE FUNCTION public.get_unread_message_count(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  unread_count integer;
BEGIN
  SELECT COUNT(*)::integer INTO unread_count
  FROM messages m
  INNER JOIN conversations c ON c.id = m.conversation_id
  WHERE (c.contractor_user_id = _user_id OR c.employee_user_id = _user_id)
    AND m.sender_user_id != _user_id
    AND c.status = 'active'
    AND m.created_at > COALESCE(
      (SELECT last_read_at 
       FROM conversation_read_status crs 
       WHERE crs.conversation_id = c.id 
       AND crs.user_id = _user_id),
      '1970-01-01'::timestamp with time zone
    );
  RETURN unread_count;
END;
$$;

-- Add first_name and last_name columns to profiles table for employee names
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text;

-- Add is_sse column to jobs table for SSE employee tracking in farm industry
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS is_sse boolean DEFAULT false;