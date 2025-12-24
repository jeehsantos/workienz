-- Create job_status enum
CREATE TYPE public.job_status AS ENUM ('draft', 'published', 'closed', 'filled');

-- Create subscription_status enum
CREATE TYPE public.subscription_status AS ENUM ('active', 'cancelled', 'expired', 'pending');

-- Create jobs table for contractor job postings
CREATE TABLE public.jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id UUID NOT NULL REFERENCES public.contractor_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT,
  location_city TEXT,
  location_suburb TEXT,
  location_country TEXT,
  job_type TEXT NOT NULL DEFAULT 'temporary', -- temporary, short-term, contract
  duration TEXT, -- e.g., "2 weeks", "1 month"
  hourly_rate_min NUMERIC,
  hourly_rate_max NUMERIC,
  skills_required TEXT[],
  status job_status NOT NULL DEFAULT 'draft',
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create job_applications table
CREATE TABLE public.job_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employee_profiles(id) ON DELETE CASCADE,
  cover_letter TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, reviewed, shortlisted, rejected, hired
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(job_id, employee_id)
);

-- Create subscriptions table for article access
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_name TEXT NOT NULL DEFAULT 'basic',
  status subscription_status NOT NULL DEFAULT 'pending',
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create articles table
CREATE TABLE public.articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL,
  cover_image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  is_premium BOOLEAN NOT NULL DEFAULT true, -- requires subscription
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Jobs RLS policies
CREATE POLICY "Anyone can view published jobs"
  ON public.jobs FOR SELECT
  USING (status = 'published');

CREATE POLICY "Contractors can view their own jobs"
  ON public.jobs FOR SELECT
  USING (contractor_id IN (SELECT id FROM public.contractor_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Contractors can insert their own jobs"
  ON public.jobs FOR INSERT
  WITH CHECK (contractor_id IN (SELECT id FROM public.contractor_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Contractors can update their own jobs"
  ON public.jobs FOR UPDATE
  USING (contractor_id IN (SELECT id FROM public.contractor_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Contractors can delete their own jobs"
  ON public.jobs FOR DELETE
  USING (contractor_id IN (SELECT id FROM public.contractor_profiles WHERE user_id = auth.uid()));

-- Job applications RLS policies
CREATE POLICY "Employees can view their own applications"
  ON public.job_applications FOR SELECT
  USING (employee_id IN (SELECT id FROM public.employee_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Contractors can view applications for their jobs"
  ON public.job_applications FOR SELECT
  USING (job_id IN (SELECT id FROM public.jobs WHERE contractor_id IN (SELECT id FROM public.contractor_profiles WHERE user_id = auth.uid())));

CREATE POLICY "Employees can apply to jobs"
  ON public.job_applications FOR INSERT
  WITH CHECK (employee_id IN (SELECT id FROM public.employee_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Employees can update their own applications"
  ON public.job_applications FOR UPDATE
  USING (employee_id IN (SELECT id FROM public.employee_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Contractors can update application status"
  ON public.job_applications FOR UPDATE
  USING (job_id IN (SELECT id FROM public.jobs WHERE contractor_id IN (SELECT id FROM public.contractor_profiles WHERE user_id = auth.uid())));

-- Subscriptions RLS policies
CREATE POLICY "Users can view their own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Articles RLS policies
CREATE POLICY "Anyone can view published articles metadata"
  ON public.articles FOR SELECT
  USING (is_published = true);

CREATE POLICY "Writers can view their own articles"
  ON public.articles FOR SELECT
  USING (author_id = auth.uid());

CREATE POLICY "Writers can insert articles"
  ON public.articles FOR INSERT
  WITH CHECK (author_id = auth.uid() AND has_role(auth.uid(), 'writer'));

CREATE POLICY "Writers can update their own articles"
  ON public.articles FOR UPDATE
  USING (author_id = auth.uid() AND has_role(auth.uid(), 'writer'));

-- Create function to check active subscription
CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions
    WHERE user_id = _user_id
      AND status = 'active'
      AND (ends_at IS NULL OR ends_at > now())
  )
$$;

-- Add triggers for updated_at
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_job_applications_updated_at
  BEFORE UPDATE ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();