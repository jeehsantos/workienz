-- Task 2: Add weekly_hours column to jobs table for fixed term jobs
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS weekly_hours INTEGER DEFAULT NULL;

-- Task 4: Add scheduled_deletion_at column to conversations for 48-hour auto-delete
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS scheduled_deletion_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Task 5: Create partners table for partner management
CREATE TABLE IF NOT EXISTS public.partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_user_id UUID NOT NULL,
  display_name TEXT NOT NULL,
  logo_url TEXT DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  discount_percent INTEGER DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  stripe_coupon_id TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on partners table
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- RLS policies for partners table
CREATE POLICY "Anyone can view active partners" 
ON public.partners 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can view all partners" 
ON public.partners 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert partners" 
ON public.partners 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update partners" 
ON public.partners 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete partners" 
ON public.partners 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at on partners
CREATE TRIGGER update_partners_updated_at
BEFORE UPDATE ON public.partners
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for partner logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('partner-logos', 'partner-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for partner logos
CREATE POLICY "Anyone can view partner logos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'partner-logos');

CREATE POLICY "Admins can upload partner logos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'partner-logos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update partner logos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'partner-logos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete partner logos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'partner-logos' AND has_role(auth.uid(), 'admin'::app_role));