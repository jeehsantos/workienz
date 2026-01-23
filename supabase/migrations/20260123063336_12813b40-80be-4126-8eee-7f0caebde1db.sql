-- Add hidden column to plan_products for admin to hide tiers
ALTER TABLE public.plan_products 
ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT false;

-- Add free tier record for contractors if not exists
INSERT INTO public.plan_products (
  plan_id,
  plan_name,
  plan_type,
  price_cents,
  interval,
  description,
  features,
  coming_soon,
  hidden
)
SELECT
  'free_contractor',
  'Free Tier',
  'contractor',
  0,
  NULL,
  'Start hiring for free with basic features',
  '["1 active job posting", "30-day job listing", "1 hire per job", "Basic applicant management"]'::jsonb,
  false,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.plan_products WHERE plan_id = 'free_contractor'
);

-- Add platform settings for free tier job expiry days
INSERT INTO public.platform_settings (setting_key, setting_value, description)
SELECT 'free_tier_job_expiry_days', '30', 'Number of days before free tier jobs auto-expire'
WHERE NOT EXISTS (
  SELECT 1 FROM public.platform_settings WHERE setting_key = 'free_tier_job_expiry_days'
);

-- Add platform setting for free tier max hires per job
INSERT INTO public.platform_settings (setting_key, setting_value, description)
SELECT 'free_tier_max_hires_per_job', '1', 'Maximum hires per job for free tier contractors'
WHERE NOT EXISTS (
  SELECT 1 FROM public.platform_settings WHERE setting_key = 'free_tier_max_hires_per_job'
);