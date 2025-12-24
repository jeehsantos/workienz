-- Add is_premium column to subscriptions table for user premium status
-- This is already handled by existing subscriptions table

-- Add is_entrepreneur column to contractor_profiles  
ALTER TABLE public.contractor_profiles 
ADD COLUMN IF NOT EXISTS is_entrepreneur boolean DEFAULT false;

-- Create contractor_packages table for job posting limits
CREATE TABLE public.contractor_packages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL,
  jobs_per_week integer NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contractor_packages ENABLE ROW LEVEL SECURITY;

-- Anyone can view packages
CREATE POLICY "Anyone can view packages"
ON public.contractor_packages
FOR SELECT
USING (is_active = true);

-- Admins can manage packages
CREATE POLICY "Admins can manage packages"
ON public.contractor_packages
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Create contractor_subscriptions table to track contractor package subscriptions
CREATE TABLE public.contractor_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_profile_id uuid NOT NULL REFERENCES public.contractor_profiles(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.contractor_packages(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  jobs_posted_this_week integer DEFAULT 0,
  week_start_date date NOT NULL DEFAULT CURRENT_DATE,
  starts_at timestamp with time zone NOT NULL DEFAULT now(),
  ends_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contractor_subscriptions ENABLE ROW LEVEL SECURITY;

-- Contractors can view their own subscriptions
CREATE POLICY "Contractors can view their own subscriptions"
ON public.contractor_subscriptions
FOR SELECT
USING (contractor_profile_id IN (
  SELECT id FROM public.contractor_profiles WHERE user_id = auth.uid()
));

-- Admins can manage all subscriptions
CREATE POLICY "Admins can manage all contractor subscriptions"
ON public.contractor_subscriptions
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Insert default packages
INSERT INTO public.contractor_packages (name, description, price_cents, jobs_per_week) VALUES
('Basic', 'Post 1 job per week', 2000, 1),
('Pro', 'Post unlimited jobs per week', 4000, -1);

-- Create trigger for updated_at
CREATE TRIGGER update_contractor_packages_updated_at
BEFORE UPDATE ON public.contractor_packages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contractor_subscriptions_updated_at
BEFORE UPDATE ON public.contractor_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();