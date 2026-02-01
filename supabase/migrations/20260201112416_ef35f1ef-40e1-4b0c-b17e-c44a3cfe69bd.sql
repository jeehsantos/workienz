
-- Create the missing trigger to restore job slots when jobs are deleted
CREATE TRIGGER trigger_handle_job_delete
  BEFORE DELETE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_job_delete();

-- Add a comment explaining the trigger purpose
COMMENT ON TRIGGER trigger_handle_job_delete ON public.jobs IS 
  'Restores entitlement job slots when a published job is deleted';
