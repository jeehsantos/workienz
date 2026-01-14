-- Create contractor_entitlements table for tracking job posting allowances
CREATE TABLE public.contractor_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan_type TEXT NOT NULL, -- 'single_post', '14_day_sprint', 'monthly_contractor', 'quarterly_contractor'
  is_recurring BOOLEAN DEFAULT false,
  job_allowance INTEGER, -- NULL for unlimited plans
  jobs_used INTEGER DEFAULT 0,
  purchased_at TIMESTAMPTZ DEFAULT now(),
  activated_at TIMESTAMPTZ, -- When first job is published (for one-time plans)
  expires_at TIMESTAMPTZ,
  is_stackable BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active', -- 'active', 'expired', 'consumed'
  stripe_subscription_id TEXT,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contractor_entitlements ENABLE ROW LEVEL SECURITY;

-- RLS policies for contractor_entitlements
CREATE POLICY "Users can view their own entitlements"
ON public.contractor_entitlements
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all entitlements"
ON public.contractor_entitlements
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert entitlements"
ON public.contractor_entitlements
FOR INSERT
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can update entitlements"
ON public.contractor_entitlements
FOR UPDATE
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Create updated_at trigger
CREATE TRIGGER update_contractor_entitlements_updated_at
BEFORE UPDATE ON public.contractor_entitlements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add tier limit platform settings
INSERT INTO public.platform_settings (setting_key, setting_value, description) VALUES
('single_post_job_limit', '1', 'Maximum jobs for Single Post tier'),
('single_post_duration_days', '14', 'Duration in days after first job published for Single Post'),
('14_day_sprint_duration_days', '14', 'Duration in days after first job published for 14-Day Sprint'),
('14_day_sprint_job_limit', '3', 'Maximum jobs for 14-Day Sprint tier')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;

-- Backfill entitlements from existing subscriptions
INSERT INTO public.contractor_entitlements (user_id, plan_type, is_recurring, job_allowance, status, stripe_subscription_id, purchased_at)
SELECT 
  s.user_id,
  CASE 
    WHEN s.plan_name ILIKE '%single%' THEN 'single_post'
    WHEN s.plan_name ILIKE '%sprint%' OR s.plan_name ILIKE '%14%day%' THEN '14_day_sprint'
    WHEN s.plan_name ILIKE '%monthly%' THEN 'monthly_contractor'
    WHEN s.plan_name ILIKE '%quarterly%' THEN 'quarterly_contractor'
    ELSE s.plan_name
  END as plan_type,
  CASE 
    WHEN s.plan_name ILIKE '%single%' OR s.plan_name ILIKE '%sprint%' OR s.plan_name ILIKE '%14%day%' THEN false
    ELSE true
  END as is_recurring,
  CASE 
    WHEN s.plan_name ILIKE '%single%' THEN 1
    WHEN s.plan_name ILIKE '%sprint%' OR s.plan_name ILIKE '%14%day%' THEN 3
    ELSE NULL -- unlimited for monthly/quarterly
  END as job_allowance,
  s.status::text,
  s.stripe_subscription_id,
  s.created_at
FROM public.subscriptions s
WHERE s.status = 'active'
AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = s.user_id AND ur.role = 'contractor')
ON CONFLICT DO NOTHING;