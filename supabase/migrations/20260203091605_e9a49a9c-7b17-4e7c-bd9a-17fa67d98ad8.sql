-- Drop the problematic BEFORE DELETE trigger
DROP TRIGGER IF EXISTS on_conversation_delete ON public.conversations;

-- Create improved function that works as AFTER DELETE
-- Messages are already cascade-deleted by the foreign key, so we don't need to delete them
CREATE OR REPLACE FUNCTION public.handle_conversation_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- If this conversation was linked to a job application, restore the position
  -- Note: job_application might already be deleted if it has CASCADE, check first
  IF OLD.job_application_id IS NOT NULL THEN
    -- Get the job_id from the application and decrement positions_filled
    -- Use a subquery that handles the case where application might already be deleted
    UPDATE public.jobs 
    SET positions_filled = GREATEST(positions_filled - 1, 0)
    WHERE id IN (
      SELECT job_id FROM public.job_applications WHERE id = OLD.job_application_id
    );
    
    -- Delete the job application if it still exists
    DELETE FROM public.job_applications WHERE id = OLD.job_application_id;
  END IF;
  
  RETURN OLD;
END;
$function$;

-- Recreate as AFTER DELETE trigger to avoid the "tuple already modified" error
CREATE TRIGGER on_conversation_delete
  AFTER DELETE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION handle_conversation_delete();