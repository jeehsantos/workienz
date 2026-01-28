-- Create referral status enum
CREATE TYPE public.referral_status AS ENUM ('pending', 'verified', 'voided');

-- Create referrals table for tracking all referrals
CREATE TABLE public.referrals (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    referrer_user_id UUID NOT NULL,
    referred_user_id UUID NOT NULL,
    referral_code TEXT NOT NULL,
    status referral_status NOT NULL DEFAULT 'pending',
    ip_address INET,
    user_agent TEXT,
    verified_at TIMESTAMP WITH TIME ZONE,
    voided_at TIMESTAMP WITH TIME ZONE,
    voided_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (referrer_user_id, referred_user_id)
);

-- Create employee_referral_credits table for tracking referral credit balances
CREATE TABLE public.employee_referral_credits (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    total_verified_referrals INTEGER NOT NULL DEFAULT 0,
    bonus_credits_balance INTEGER NOT NULL DEFAULT 0,
    bonus_credits_used INTEGER NOT NULL DEFAULT 0,
    has_premium_article_access BOOLEAN NOT NULL DEFAULT false,
    referral_code TEXT NOT NULL UNIQUE,
    is_shadow_banned BOOLEAN NOT NULL DEFAULT false,
    shadow_banned_at TIMESTAMP WITH TIME ZONE,
    shadow_banned_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX idx_referrals_referrer ON public.referrals (referrer_user_id);
CREATE INDEX idx_referrals_referred ON public.referrals (referred_user_id);
CREATE INDEX idx_referrals_code ON public.referrals (referral_code);
CREATE INDEX idx_referrals_status ON public.referrals (status);
CREATE INDEX idx_employee_referral_credits_code ON public.employee_referral_credits (referral_code);

-- Enable RLS on referrals
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Enable RLS on employee_referral_credits
ALTER TABLE public.employee_referral_credits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for referrals table
CREATE POLICY "Users can view referrals they made"
ON public.referrals
FOR SELECT
USING (auth.uid() = referrer_user_id);

CREATE POLICY "Users can view referrals made to them"
ON public.referrals
FOR SELECT
USING (auth.uid() = referred_user_id);

CREATE POLICY "Admins can view all referrals"
ON public.referrals
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update referrals"
ON public.referrals
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete referrals"
ON public.referrals
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for employee_referral_credits table
CREATE POLICY "Users can view their own referral credits"
ON public.employee_referral_credits
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own referral credits"
ON public.employee_referral_credits
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own referral credits"
ON public.employee_referral_credits
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all referral credits"
ON public.employee_referral_credits
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all referral credits"
ON public.employee_referral_credits
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Trigger to update updated_at on referrals
CREATE TRIGGER update_referrals_updated_at
    BEFORE UPDATE ON public.referrals
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to update updated_at on employee_referral_credits
CREATE TRIGGER update_employee_referral_credits_updated_at
    BEFORE UPDATE ON public.employee_referral_credits
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate a unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    code TEXT;
    exists_count INTEGER;
BEGIN
    LOOP
        -- Generate a random 8-character alphanumeric code
        code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
        
        -- Check if it already exists
        SELECT COUNT(*) INTO exists_count
        FROM public.employee_referral_credits
        WHERE referral_code = code;
        
        IF exists_count = 0 THEN
            RETURN code;
        END IF;
    END LOOP;
END;
$$;

-- Function to calculate bonus credits based on verified referrals (milestone system)
CREATE OR REPLACE FUNCTION public.calculate_referral_bonus_credits(verified_count INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
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

-- Function to check if user has premium article access based on referrals
CREATE OR REPLACE FUNCTION public.has_referral_premium_access(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT has_premium_article_access FROM public.employee_referral_credits WHERE user_id = _user_id),
        false
    )
$$;

-- Function to get remaining referral application credits for a user
CREATE OR REPLACE FUNCTION public.get_referral_credits_balance(_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT bonus_credits_balance - bonus_credits_used 
         FROM public.employee_referral_credits 
         WHERE user_id = _user_id AND NOT is_shadow_banned),
        0
    )
$$;