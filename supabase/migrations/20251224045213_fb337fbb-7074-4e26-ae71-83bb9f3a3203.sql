-- Create conversations table for temporary messaging
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_application_id uuid NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  contractor_user_id uuid NOT NULL,
  employee_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_application_id)
);

-- Create messages table
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Conversations RLS: Only participants can view/update
CREATE POLICY "Participants can view their conversations"
ON public.conversations FOR SELECT
USING (auth.uid() = contractor_user_id OR auth.uid() = employee_user_id);

CREATE POLICY "System can create conversations"
ON public.conversations FOR INSERT
WITH CHECK (auth.uid() = contractor_user_id OR auth.uid() = employee_user_id);

CREATE POLICY "Participants can update conversation status"
ON public.conversations FOR UPDATE
USING (auth.uid() = contractor_user_id OR auth.uid() = employee_user_id);

-- Messages RLS: Only conversation participants can view/send
CREATE POLICY "Participants can view messages"
ON public.messages FOR SELECT
USING (
  conversation_id IN (
    SELECT id FROM public.conversations 
    WHERE contractor_user_id = auth.uid() OR employee_user_id = auth.uid()
  )
);

CREATE POLICY "Participants can send messages in active conversations"
ON public.messages FOR INSERT
WITH CHECK (
  sender_user_id = auth.uid() AND
  conversation_id IN (
    SELECT id FROM public.conversations 
    WHERE (contractor_user_id = auth.uid() OR employee_user_id = auth.uid())
    AND status = 'active'
  )
);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Add phone field to contractor_profiles for contact sharing
ALTER TABLE public.contractor_profiles ADD COLUMN IF NOT EXISTS phone text;

-- Add phone field to employee_profiles for contact sharing  
ALTER TABLE public.employee_profiles ADD COLUMN IF NOT EXISTS phone text;

-- Create function to increment positions_filled when application is created
CREATE OR REPLACE FUNCTION public.increment_positions_filled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.jobs 
  SET positions_filled = positions_filled + 1
  WHERE id = NEW.job_id;
  RETURN NEW;
END;
$$;

-- Create trigger for new applications
CREATE TRIGGER on_job_application_created
  AFTER INSERT ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_positions_filled();

-- Create function to decrement positions_filled when application is rejected
CREATE OR REPLACE FUNCTION public.handle_application_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If status changed to rejected, decrement positions_filled
  IF OLD.status != 'rejected' AND NEW.status = 'rejected' THEN
    UPDATE public.jobs 
    SET positions_filled = GREATEST(positions_filled - 1, 0)
    WHERE id = NEW.job_id;
  END IF;
  
  -- If status changed FROM rejected to something else, increment again
  IF OLD.status = 'rejected' AND NEW.status != 'rejected' THEN
    UPDATE public.jobs 
    SET positions_filled = positions_filled + 1
    WHERE id = NEW.job_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for application status changes
CREATE TRIGGER on_job_application_status_change
  AFTER UPDATE OF status ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_application_status_change();

-- Triggers for updated_at
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();