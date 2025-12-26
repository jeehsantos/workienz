-- Create trigger on auth.users to call handle_new_user function
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Add DELETE policy for conversations (so closing/deleting chats works)
CREATE POLICY "Participants can delete their conversations"
ON public.conversations
FOR DELETE
USING (auth.uid() = contractor_user_id OR auth.uid() = employee_user_id);

-- Create function to handle conversation deletion and restore positions
CREATE OR REPLACE FUNCTION public.handle_conversation_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If this conversation is linked to a job application, restore the position
  IF OLD.job_application_id IS NOT NULL THEN
    -- Get the job_id from the application
    UPDATE public.jobs 
    SET positions_filled = GREATEST(positions_filled - 1, 0)
    WHERE id = (SELECT job_id FROM public.job_applications WHERE id = OLD.job_application_id);
    
    -- Also delete the job application
    DELETE FROM public.job_applications WHERE id = OLD.job_application_id;
  END IF;
  
  RETURN OLD;
END;
$$;

-- Create trigger for conversation deletion
CREATE TRIGGER on_conversation_delete
  BEFORE DELETE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.handle_conversation_delete();