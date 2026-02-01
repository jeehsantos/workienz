-- ============================================
-- JOURNEYS & TOPIC HUBS CONTENT MANAGEMENT
-- ============================================

-- Create article_type enum
DO $$ BEGIN
  CREATE TYPE public.article_type AS ENUM ('qa', 'guide', 'checklist');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create user_stage enum
DO $$ BEGIN
  CREATE TYPE public.user_stage AS ENUM ('before_arrival', 'arrival', 'first_30_days', 'living_here');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create visa_type enum
DO $$ BEGIN
  CREATE TYPE public.visa_type AS ENUM ('all', 'student', 'worker', 'whv', 'tourist', 'resident');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- JOURNEYS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  icon_name TEXT DEFAULT 'FileText',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint for title
ALTER TABLE public.journeys ADD CONSTRAINT journeys_title_unique UNIQUE (title);

-- Enable RLS
ALTER TABLE public.journeys ENABLE ROW LEVEL SECURITY;

-- RLS Policies for journeys
CREATE POLICY "Anyone can view active journeys"
  ON public.journeys FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can view all journeys"
  ON public.journeys FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert journeys"
  ON public.journeys FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update journeys"
  ON public.journeys FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete journeys"
  ON public.journeys FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- TOPIC HUBS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.topic_hubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES public.journeys(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint for title within journey
ALTER TABLE public.topic_hubs ADD CONSTRAINT topic_hubs_journey_title_unique UNIQUE (journey_id, title);

-- Enable RLS
ALTER TABLE public.topic_hubs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for topic_hubs
CREATE POLICY "Anyone can view active topic hubs"
  ON public.topic_hubs FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can view all topic hubs"
  ON public.topic_hubs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert topic hubs"
  ON public.topic_hubs FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update topic hubs"
  ON public.topic_hubs FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete topic hubs"
  ON public.topic_hubs FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- ENHANCE ARTICLES TABLE
-- ============================================
-- Add new columns to articles table
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS journey_id UUID REFERENCES public.journeys(id) ON DELETE SET NULL;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES public.topic_hubs(id) ON DELETE SET NULL;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS content_blocks JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS article_type TEXT DEFAULT 'qa';
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS visa_type TEXT DEFAULT 'all';
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS user_stage TEXT DEFAULT 'before_arrival';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_articles_journey_id ON public.articles(journey_id);
CREATE INDEX IF NOT EXISTS idx_articles_topic_id ON public.articles(topic_id);
CREATE INDEX IF NOT EXISTS idx_articles_visa_type ON public.articles(visa_type);
CREATE INDEX IF NOT EXISTS idx_articles_user_stage ON public.articles(user_stage);
CREATE INDEX IF NOT EXISTS idx_articles_article_type ON public.articles(article_type);
CREATE INDEX IF NOT EXISTS idx_topic_hubs_journey_id ON public.topic_hubs(journey_id);
CREATE INDEX IF NOT EXISTS idx_journeys_display_order ON public.journeys(display_order);
CREATE INDEX IF NOT EXISTS idx_topic_hubs_display_order ON public.topic_hubs(display_order);

-- ============================================
-- VALIDATION FUNCTION FOR ARTICLES
-- ============================================
CREATE OR REPLACE FUNCTION public.validate_article_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  content_length INTEGER;
BEGIN
  -- Validate title is not empty
  IF NEW.title IS NULL OR trim(NEW.title) = '' THEN
    RAISE EXCEPTION 'Article title cannot be empty';
  END IF;
  
  -- Validate title length
  IF length(NEW.title) > 500 THEN
    RAISE EXCEPTION 'Article title must be less than 500 characters';
  END IF;
  
  -- For published articles, require summary
  IF NEW.is_published = true THEN
    IF NEW.summary IS NULL OR trim(NEW.summary) = '' THEN
      RAISE EXCEPTION 'Published articles must have a summary (TL;DR)';
    END IF;
    
    -- Require content for published articles
    IF NEW.content IS NULL OR trim(NEW.content) = '' THEN
      IF NEW.content_blocks IS NULL OR jsonb_array_length(NEW.content_blocks) = 0 THEN
        RAISE EXCEPTION 'Published articles must have content';
      END IF;
    END IF;
  END IF;
  
  -- Validate summary length if provided
  IF NEW.summary IS NOT NULL AND length(NEW.summary) > 500 THEN
    RAISE EXCEPTION 'Summary must be less than 500 characters';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for article validation
DROP TRIGGER IF EXISTS validate_article_content_trigger ON public.articles;
CREATE TRIGGER validate_article_content_trigger
  BEFORE INSERT OR UPDATE ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_article_content();

-- ============================================
-- FUNCTION TO CHECK DUPLICATE TITLES
-- ============================================
CREATE OR REPLACE FUNCTION public.check_article_title_duplicate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  -- Check for duplicate titles (case insensitive)
  SELECT COUNT(*) INTO existing_count
  FROM public.articles
  WHERE lower(trim(title)) = lower(trim(NEW.title))
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  IF existing_count > 0 THEN
    RAISE EXCEPTION 'An article with this title already exists';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for duplicate title check
DROP TRIGGER IF EXISTS check_article_title_duplicate_trigger ON public.articles;
CREATE TRIGGER check_article_title_duplicate_trigger
  BEFORE INSERT OR UPDATE ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_article_title_duplicate();

-- ============================================
-- UPDATE TIMESTAMPS TRIGGERS
-- ============================================
CREATE TRIGGER update_journeys_updated_at
  BEFORE UPDATE ON public.journeys
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_topic_hubs_updated_at
  BEFORE UPDATE ON public.topic_hubs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();