-- Add message content length constraint
ALTER TABLE public.messages 
ADD CONSTRAINT messages_content_length 
CHECK (LENGTH(content) > 0 AND LENGTH(content) <= 5000);