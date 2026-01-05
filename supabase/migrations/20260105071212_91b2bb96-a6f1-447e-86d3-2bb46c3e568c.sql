-- Create notifications table for in-app notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  action_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for quick lookups
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, read) WHERE read = false;
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Add activity tracking columns to conversations
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS activity_started_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0;

-- Trigger: Update last_activity_at on new message
CREATE OR REPLACE FUNCTION public.update_conversation_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET last_activity_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_conversation_activity
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_activity();

-- Trigger: Initialize timestamps on conversation creation
CREATE OR REPLACE FUNCTION public.initialize_conversation_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.activity_started_at := NOW();
  NEW.last_activity_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_initialize_conversation_activity
BEFORE INSERT ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.initialize_conversation_activity();

-- Trigger: Restore job position when conversation is closed via status update
CREATE OR REPLACE FUNCTION public.restore_job_position_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act when status changes to 'closed' and conversation has a job application
  IF NEW.status = 'closed' AND OLD.status != 'closed' AND NEW.job_application_id IS NOT NULL THEN
    UPDATE public.jobs 
    SET positions_filled = GREATEST(0, positions_filled - 1)
    WHERE id = (SELECT job_id FROM public.job_applications WHERE id = NEW.job_application_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_restore_position_on_status_change
AFTER UPDATE ON public.conversations
FOR EACH ROW
WHEN (NEW.status IS DISTINCT FROM OLD.status)
EXECUTE FUNCTION public.restore_job_position_on_status_change();