-- Add category field to articles table
ALTER TABLE public.articles 
ADD COLUMN IF NOT EXISTS category text;

-- Add index for category filtering
CREATE INDEX IF NOT EXISTS idx_articles_category ON public.articles(category);
