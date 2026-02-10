
-- Create contractor_favorite_workers table
CREATE TABLE public.contractor_favorite_workers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_user_id UUID NOT NULL,
  employee_user_id UUID NOT NULL,
  employee_profile_id UUID NOT NULL,
  note TEXT,
  job_id UUID, -- the job where the employee was hired (for context)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- A contractor can only favorite the same employee once
  CONSTRAINT unique_contractor_employee_favorite UNIQUE (contractor_user_id, employee_user_id)
);

-- Enable RLS
ALTER TABLE public.contractor_favorite_workers ENABLE ROW LEVEL SECURITY;

-- Contractors can view their own favorites
CREATE POLICY "Contractors can view own favorites"
ON public.contractor_favorite_workers
FOR SELECT
USING (auth.uid() = contractor_user_id);

-- Contractors can insert their own favorites
CREATE POLICY "Contractors can insert own favorites"
ON public.contractor_favorite_workers
FOR INSERT
WITH CHECK (auth.uid() = contractor_user_id AND has_role(auth.uid(), 'contractor'::app_role));

-- Contractors can update their own favorites (notes)
CREATE POLICY "Contractors can update own favorites"
ON public.contractor_favorite_workers
FOR UPDATE
USING (auth.uid() = contractor_user_id);

-- Contractors can delete their own favorites
CREATE POLICY "Contractors can delete own favorites"
ON public.contractor_favorite_workers
FOR DELETE
USING (auth.uid() = contractor_user_id);

-- Admins can view all favorites
CREATE POLICY "Admins can view all favorites"
ON public.contractor_favorite_workers
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add updated_at trigger
CREATE TRIGGER update_contractor_favorite_workers_updated_at
BEFORE UPDATE ON public.contractor_favorite_workers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookup
CREATE INDEX idx_contractor_favorites_contractor ON public.contractor_favorite_workers (contractor_user_id);
CREATE INDEX idx_contractor_favorites_employee ON public.contractor_favorite_workers (employee_user_id);
