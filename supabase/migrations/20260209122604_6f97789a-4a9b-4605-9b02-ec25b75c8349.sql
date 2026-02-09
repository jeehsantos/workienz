
-- =====================================================
-- Contractor Referral Program: Database Schema
-- =====================================================

-- 1. Contractor Referrals table (separate from employee referrals)
CREATE TABLE public.contractor_referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_user_id UUID NOT NULL,
  referred_user_id UUID NOT NULL,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'qualified', 'voided')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  qualified_at TIMESTAMP WITH TIME ZONE,
  voided_at TIMESTAMP WITH TIME ZONE,
  voided_reason TEXT,
  ip_address INET,
  user_agent TEXT
);

-- Unique: a referred user can only be linked once
CREATE UNIQUE INDEX idx_contractor_referrals_referred_user ON public.contractor_referrals(referred_user_id);
-- Index for looking up referrals by referrer
CREATE INDEX idx_contractor_referrals_referrer ON public.contractor_referrals(referrer_user_id);

-- Enable RLS
ALTER TABLE public.contractor_referrals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view referrals they made" ON public.contractor_referrals
  FOR SELECT USING (auth.uid() = referrer_user_id);

CREATE POLICY "Users can view referrals made to them" ON public.contractor_referrals
  FOR SELECT USING (auth.uid() = referred_user_id);

CREATE POLICY "Admins can view all contractor referrals" ON public.contractor_referrals
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update contractor referrals" ON public.contractor_referrals
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete contractor referrals" ON public.contractor_referrals
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_contractor_referrals_updated_at
  BEFORE UPDATE ON public.contractor_referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Contractor Referral Rewards table (audit trail)
CREATE TABLE public.contractor_referral_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_id UUID NOT NULL REFERENCES public.contractor_referrals(id) ON DELETE CASCADE,
  referrer_user_id UUID NOT NULL,
  days_granted INTEGER NOT NULL,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  job_post_id UUID NOT NULL,
  entitlement_id UUID REFERENCES public.contractor_entitlements(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique: one reward per referral (prevents double-grant)
CREATE UNIQUE INDEX idx_contractor_referral_rewards_referral ON public.contractor_referral_rewards(referral_id);
-- Index for looking up rewards by referrer
CREATE INDEX idx_contractor_referral_rewards_referrer ON public.contractor_referral_rewards(referrer_user_id);

-- Enable RLS
ALTER TABLE public.contractor_referral_rewards ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own rewards" ON public.contractor_referral_rewards
  FOR SELECT USING (auth.uid() = referrer_user_id);

CREATE POLICY "Admins can view all rewards" ON public.contractor_referral_rewards
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage rewards" ON public.contractor_referral_rewards
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. Contractor Referral Codes table (stores referral codes for contractors)
CREATE TABLE public.contractor_referral_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  referral_code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contractor_referral_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own referral code" ON public.contractor_referral_codes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own referral code" ON public.contractor_referral_codes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all contractor referral codes" ON public.contractor_referral_codes
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage contractor referral codes" ON public.contractor_referral_codes
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_contractor_referral_codes_updated_at
  BEFORE UPDATE ON public.contractor_referral_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Add contractor referral settings to platform_settings
INSERT INTO public.platform_settings (setting_key, setting_value, description)
VALUES 
  ('contractor_referral_premium_days', '3', 'Number of Premium days granted per successful contractor referral'),
  ('contractor_referral_enabled', 'true', 'Whether the contractor referral program is enabled')
ON CONFLICT DO NOTHING;

-- 5. Generate referral code function for contractors (reuses same logic)
CREATE OR REPLACE FUNCTION public.generate_contractor_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    code TEXT;
    exists_count INTEGER;
BEGIN
    LOOP
        code := 'C-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
        
        SELECT COUNT(*) INTO exists_count
        FROM public.contractor_referral_codes
        WHERE referral_code = code;
        
        IF exists_count = 0 THEN
            RETURN code;
        END IF;
    END LOOP;
END;
$$;
