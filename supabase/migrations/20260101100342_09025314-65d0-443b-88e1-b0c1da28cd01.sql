-- Enable REPLICA IDENTITY FULL for messages table to capture complete row data for realtime
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Add messages table to supabase_realtime publication for real-time updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;