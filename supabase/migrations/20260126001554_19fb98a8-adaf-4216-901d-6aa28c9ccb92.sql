-- Update the handle_job_delete function to handle both free_tier and free_contractor plan types
CREATE OR REPLACE FUNCTION public.handle_job_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  contractor_user_id UUID;
  target_entitlement_id UUID;
BEGIN
  -- Only act if the job was published (consumed a slot)
  IF OLD.status = 'published' THEN
    -- Get the contractor's user_id
    SELECT cp.user_id INTO contractor_user_id
    FROM public.contractor_profiles cp
    WHERE cp.id = OLD.contractor_id;

    IF contractor_user_id IS NOT NULL THEN
      -- Find the most appropriate entitlement to credit back
      -- Priority: active entitlements that have jobs_used > 0, prefer free tier first
      SELECT id INTO target_entitlement_id
      FROM public.contractor_entitlements
      WHERE user_id = contractor_user_id
        AND jobs_used > 0
        AND status IN ('active', 'consumed')
      ORDER BY 
        CASE WHEN plan_type IN ('free_tier', 'free_contractor') THEN 0 ELSE 1 END,
        created_at DESC
      LIMIT 1;

      IF target_entitlement_id IS NOT NULL THEN
        -- Decrement jobs_used
        UPDATE public.contractor_entitlements
        SET 
          jobs_used = GREATEST(0, jobs_used - 1),
          -- If it was consumed and now has available slots, mark as active again
          status = CASE 
            WHEN status = 'consumed' AND job_allowance IS NOT NULL AND (jobs_used - 1) < job_allowance THEN 'active'
            ELSE status
          END,
          updated_at = now()
        WHERE id = target_entitlement_id;
      END IF;
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$;