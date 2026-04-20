
-- =====================================================
-- FIX 1: Hide stripe_coupon_id on partners from public
-- =====================================================
-- Drop the broad public SELECT policy
DROP POLICY IF EXISTS "Anyone can view active partners" ON public.partners;

-- Create a public view that excludes stripe_coupon_id
CREATE OR REPLACE VIEW public.partners_public
WITH (security_invoker = true)
AS
SELECT id, display_name, logo_url, discount_percent, is_active, created_at, updated_at
FROM public.partners
WHERE is_active = true;

GRANT SELECT ON public.partners_public TO anon, authenticated;

-- Restore narrow SELECT policy on partners table for the view to work via security_invoker
-- but exclude the sensitive column at the application level (clients should query the view)
CREATE POLICY "Public can view non-sensitive partner fields"
ON public.partners
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Revoke direct table SELECT on stripe_coupon_id from anon/authenticated by using column privileges
REVOKE SELECT ON public.partners FROM anon, authenticated;
GRANT SELECT (id, contractor_user_id, display_name, logo_url, discount_percent, is_active, created_at, updated_at)
  ON public.partners TO anon, authenticated;

-- =====================================================
-- FIX 2: Prevent privilege escalation on employee_referral_credits
-- =====================================================
-- Remove the broad user UPDATE policy
DROP POLICY IF EXISTS "Users can update their own referral credits" ON public.employee_referral_credits;

-- Users may still need to be able to read their record (kept), and admins can update.
-- All credit mutations now must go through SECURITY DEFINER functions or service role (edge functions).

-- Helper SECURITY DEFINER function for safely incrementing bonus_credits_used by the owner
CREATE OR REPLACE FUNCTION public.consume_referral_credit(_amount integer DEFAULT 1)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
  v_used integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  SELECT bonus_credits_balance, bonus_credits_used
    INTO v_balance, v_used
  FROM public.employee_referral_credits
  WHERE user_id = auth.uid() AND NOT is_shadow_banned
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF (v_balance - v_used) < _amount THEN
    RETURN false;
  END IF;

  UPDATE public.employee_referral_credits
  SET bonus_credits_used = bonus_credits_used + _amount,
      updated_at = now()
  WHERE user_id = auth.uid();

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_referral_credit(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_referral_credit(integer) TO authenticated;
