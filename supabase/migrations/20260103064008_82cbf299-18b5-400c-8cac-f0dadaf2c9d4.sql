-- Add Stripe fields to subscriptions table
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

-- Create plan_products table for Stripe product/price mapping
CREATE TABLE IF NOT EXISTS plan_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id TEXT NOT NULL UNIQUE,
  plan_name TEXT NOT NULL,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('contractor', 'seeker')),
  description TEXT,
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  price_cents INTEGER NOT NULL,
  interval TEXT,
  features JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed with plan data (prices in NZD cents)
INSERT INTO plan_products (plan_id, plan_name, plan_type, price_cents, interval, description, features) VALUES
('single_post', 'Single Post', 'contractor', 2400, 'one_time', 'Post 1 job for 14 days', '["1 job posting", "14-day listing duration", "Basic applicant management"]'),
('14_day_sprint', '14-Day Sprint', 'contractor', 5000, 'one_time', 'Unlimited posting for 2 weeks', '["Unlimited job postings", "14-day access", "Priority support"]'),
('monthly_contractor', 'Monthly', 'contractor', 4000, 'month', 'Unlimited posting per month', '["Unlimited job postings", "Featured listings", "Analytics dashboard"]'),
('quarterly_contractor', 'Quarterly Pro', 'contractor', 10500, 'quarter', '3 months unlimited posting', '["Unlimited job postings", "Priority support", "Advanced analytics", "Save 12%"]'),
('free_seeker', 'Free Tier', 'seeker', 0, NULL, 'Basic job seeker access', '["1 application per 3 days", "Preview-only articles", "Basic profile"]'),
('weekly_seeker', 'Premium Weekly', 'seeker', 500, 'week', 'Weekly premium access', '["3 applications per 3 days", "Full article access", "Priority Badge"]'),
('monthly_seeker', 'Premium Monthly', 'seeker', 2000, 'month', 'Monthly premium access', '["3 applications per 3 days", "Full article access", "Priority Badge"]'),
('quarterly_seeker', 'Premium Quarterly', 'seeker', 4500, 'quarter', '3 months premium access', '["3 applications per 3 days", "Full article access", "Priority Badge", "Save 25%"]')
ON CONFLICT (plan_id) DO NOTHING;

-- Enable RLS
ALTER TABLE plan_products ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for reading plan products
CREATE POLICY "Anyone can read plan_products" ON plan_products FOR SELECT USING (true);