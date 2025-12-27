-- Add industry column to employee_profiles
ALTER TABLE public.employee_profiles ADD COLUMN IF NOT EXISTS industry text;

-- Add industry column to jobs for matching
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS industry text;

-- Add schedule_type column to jobs (shifts or fixed_term)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS schedule_type text DEFAULT 'shifts';

-- Create job_shifts table for shift-based jobs
CREATE TABLE IF NOT EXISTS public.job_shifts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  shift_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  break_minutes integer DEFAULT 0,
  break_paid boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create job_work_dates table for fixed-term jobs (specific work dates)
CREATE TABLE IF NOT EXISTS public.job_work_dates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(job_id, work_date)
);

-- Enable RLS on new tables
ALTER TABLE public.job_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_work_dates ENABLE ROW LEVEL SECURITY;

-- RLS policies for job_shifts
CREATE POLICY "Anyone can view shifts for published jobs" 
ON public.job_shifts FOR SELECT 
USING (job_id IN (SELECT id FROM public.jobs WHERE status = 'published'));

CREATE POLICY "Contractors can manage their job shifts" 
ON public.job_shifts FOR ALL 
USING (job_id IN (SELECT id FROM public.jobs WHERE contractor_id IN (SELECT id FROM contractor_profiles WHERE user_id = auth.uid())))
WITH CHECK (job_id IN (SELECT id FROM public.jobs WHERE contractor_id IN (SELECT id FROM contractor_profiles WHERE user_id = auth.uid())));

-- RLS policies for job_work_dates
CREATE POLICY "Anyone can view work dates for published jobs" 
ON public.job_work_dates FOR SELECT 
USING (job_id IN (SELECT id FROM public.jobs WHERE status = 'published'));

CREATE POLICY "Contractors can manage their job work dates" 
ON public.job_work_dates FOR ALL 
USING (job_id IN (SELECT id FROM public.jobs WHERE contractor_id IN (SELECT id FROM contractor_profiles WHERE user_id = auth.uid())))
WITH CHECK (job_id IN (SELECT id FROM public.jobs WHERE contractor_id IN (SELECT id FROM contractor_profiles WHERE user_id = auth.uid())));

-- Fix the conversation delete trigger - make it more robust
-- First drop the existing trigger and function
DROP TRIGGER IF EXISTS on_conversation_delete ON public.conversations;
DROP FUNCTION IF EXISTS public.handle_conversation_delete();

-- Recreate with better handling (delete messages first, then handle job application)
CREATE OR REPLACE FUNCTION public.handle_conversation_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete all messages in this conversation first
  DELETE FROM public.messages WHERE conversation_id = OLD.id;
  
  -- If this conversation is linked to a job application, restore the position
  IF OLD.job_application_id IS NOT NULL THEN
    -- Get the job_id from the application and decrement positions_filled
    UPDATE public.jobs 
    SET positions_filled = GREATEST(positions_filled - 1, 0)
    WHERE id = (SELECT job_id FROM public.job_applications WHERE id = OLD.job_application_id);
    
    -- Delete the job application
    DELETE FROM public.job_applications WHERE id = OLD.job_application_id;
  END IF;
  
  RETURN OLD;
END;
$$;

-- Create trigger for conversation deletion
CREATE TRIGGER on_conversation_delete
  BEFORE DELETE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.handle_conversation_delete();

-- Add DELETE policy for messages so they can be deleted by the trigger
CREATE POLICY "System can delete messages in conversations"
ON public.messages FOR DELETE
USING (conversation_id IN (
  SELECT id FROM public.conversations 
  WHERE contractor_user_id = auth.uid() OR employee_user_id = auth.uid()
));

-- Add DELETE policy for job_applications so the trigger can delete them
CREATE POLICY "Contractors can delete applications for their jobs"
ON public.job_applications FOR DELETE
USING (job_id IN (
  SELECT id FROM public.jobs 
  WHERE contractor_id IN (SELECT id FROM contractor_profiles WHERE user_id = auth.uid())
));

CREATE POLICY "Employees can delete their own applications"
ON public.job_applications FOR DELETE
USING (employee_id IN (
  SELECT id FROM employee_profiles WHERE user_id = auth.uid()
));