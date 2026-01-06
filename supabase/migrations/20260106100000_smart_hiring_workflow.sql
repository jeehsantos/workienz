-- Smart Hiring Workflow Migration
-- This migration adds the automation logic for when a contractor hires an employee

-- Add scheduled_deletion_at column to conversations for 48-hour cleanup
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS scheduled_deletion_at timestamp with time zone;

-- Create index for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_conversations_scheduled_deletion 
ON public.conversations(scheduled_deletion_at) 
WHERE scheduled_deletion_at IS NOT NULL;

-- Function to handle the smart hiring workflow
CREATE OR REPLACE FUNCTION public.handle_smart_hiring()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_employee_user_id uuid;
  v_job_title text;
  v_hired_conversation_id uuid;
  v_other_app record;
BEGIN
  -- Only trigger when status changes to 'hired'
  IF NEW.status = 'hired' AND (OLD.status IS NULL OR OLD.status != 'hired') THEN
    
    -- Get the employee user_id from employee_profiles
    SELECT ep.user_id INTO v_employee_user_id
    FROM public.employee_profiles ep
    WHERE ep.id = NEW.employee_id;
    
    -- Get the job title
    SELECT j.title INTO v_job_title
    FROM public.jobs j
    WHERE j.id = NEW.job_id;
    
    -- Get the conversation ID for this application
    SELECT c.id INTO v_hired_conversation_id
    FROM public.conversations c
    WHERE c.job_application_id = NEW.id;
    
    -- 1. Set employee availability to OFF
    UPDATE public.employee_profiles
    SET is_available = false
    WHERE user_id = v_employee_user_id;
    
    -- 2. Send congratulations message to the hired employee
    IF v_hired_conversation_id IS NOT NULL THEN
      INSERT INTO public.messages (conversation_id, sender_user_id, content)
      VALUES (
        v_hired_conversation_id,
        NEW.contractor_user_id,
        '🎉 Congratulations! You have been hired for ' || COALESCE(v_job_title, 'this position') || '. Please coordinate with the employer for next steps.'
      );
      
      -- Schedule this conversation for deletion in 48 hours
      UPDATE public.conversations
      SET scheduled_deletion_at = now() + interval '48 hours'
      WHERE id = v_hired_conversation_id;
    END IF;
    
    -- 3. Reject all other pending applications for this employee and notify contractors
    FOR v_other_app IN 
      SELECT ja.id, ja.job_id, c.id as conversation_id
      FROM public.job_applications ja
      LEFT JOIN public.conversations c ON c.job_application_id = ja.id
      WHERE ja.employee_id = NEW.employee_id
        AND ja.id != NEW.id
        AND ja.status IN ('pending', 'reviewing')
    LOOP
      -- Update application status to rejected
      UPDATE public.job_applications
      SET status = 'rejected'
      WHERE id = v_other_app.id;
      
      -- Send notification message to the contractor
      IF v_other_app.conversation_id IS NOT NULL THEN
        INSERT INTO public.messages (conversation_id, sender_user_id, content)
        SELECT 
          v_other_app.conversation_id,
          c.contractor_user_id,
          '📋 This candidate has been hired by another employer. The application has been automatically closed.'
        FROM public.conversations c
        WHERE c.id = v_other_app.conversation_id;
        
        -- Schedule these conversations for deletion in 48 hours
        UPDATE public.conversations
        SET scheduled_deletion_at = now() + interval '48 hours'
        WHERE id = v_other_app.conversation_id;
      END IF;
    END LOOP;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for smart hiring workflow
DROP TRIGGER IF EXISTS trigger_smart_hiring ON public.job_applications;
CREATE TRIGGER trigger_smart_hiring
  AFTER UPDATE ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_smart_hiring();

-- Function to clean up scheduled conversations (to be called by a cron job or edge function)
CREATE OR REPLACE FUNCTION public.cleanup_scheduled_conversations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  -- Delete conversations that are past their scheduled deletion time
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

-- Add comment for documentation
COMMENT ON FUNCTION public.handle_smart_hiring() IS 'Handles the smart hiring workflow: sets employee availability to OFF, rejects other applications, sends automated messages, and schedules chat cleanup after 48 hours';
COMMENT ON FUNCTION public.cleanup_scheduled_conversations() IS 'Cleans up conversations that have been scheduled for deletion (48 hours after hiring)';
COMMENT ON COLUMN public.conversations.scheduled_deletion_at IS 'Timestamp when this conversation should be automatically deleted (set 48 hours after hiring action)';
