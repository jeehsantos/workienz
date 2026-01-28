-- Fix the calculate_referral_bonus_credits function to have a search_path
CREATE OR REPLACE FUNCTION public.calculate_referral_bonus_credits(verified_count INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    -- 1 referral = +1 credit
    -- 2 referrals = +2 credits (total 3)
    -- 3 referrals = +3 credits (same as 2, but unlocks premium)
    -- 4+ referrals = +1 for each additional
    IF verified_count <= 0 THEN
        RETURN 0;
    ELSIF verified_count = 1 THEN
        RETURN 1;
    ELSIF verified_count = 2 THEN
        RETURN 3;
    ELSIF verified_count >= 3 THEN
        -- 3 gives base 3, then +1 for each additional
        RETURN 3 + (verified_count - 2);
    END IF;
    RETURN 0;
END;
$$;