-- Create article_categories table
CREATE TABLE public.article_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add category column to articles table
ALTER TABLE public.articles 
ADD COLUMN category TEXT;

-- Enable RLS on article_categories
ALTER TABLE public.article_categories ENABLE ROW LEVEL SECURITY;

-- Anyone can view active categories
CREATE POLICY "Anyone can view active categories"
ON public.article_categories
FOR SELECT
USING (is_active = true);

-- Admins can manage categories
CREATE POLICY "Admins can manage categories"
ON public.article_categories
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_article_categories_updated_at
BEFORE UPDATE ON public.article_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default categories
INSERT INTO public.article_categories (name, slug, display_order) VALUES
('Career Tips', 'career-tips', 1),
('Industry News', 'industry-news', 2),
('Job Search', 'job-search', 3),
('Workplace Skills', 'workplace-skills', 4);