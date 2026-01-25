-- Create article_categories table for admin management
CREATE TABLE IF NOT EXISTS public.article_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    name text NOT NULL UNIQUE,
    slug text NOT NULL UNIQUE,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Add RLS policies
ALTER TABLE public.article_categories ENABLE ROW LEVEL SECURITY;

-- Everyone can read active categories
CREATE POLICY "Anyone can view active categories"
    ON public.article_categories
    FOR SELECT
    USING (is_active = true);

-- Only admins can manage categories
CREATE POLICY "Admins can manage categories"
    ON public.article_categories
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Insert default categories
INSERT INTO public.article_categories (name, slug, description, display_order) VALUES
    ('Career Advice', 'career-advice', 'Tips and guidance for career development', 1),
    ('Job Search', 'job-search', 'Strategies for finding and applying to jobs', 2),
    ('Interview Tips', 'interview-tips', 'Advice for successful job interviews', 3),
    ('Resume Writing', 'resume-writing', 'How to create effective resumes and CVs', 4),
    ('Workplace Skills', 'workplace-skills', 'Essential skills for the workplace', 5),
    ('Industry Insights', 'industry-insights', 'Trends and news from various industries', 6),
    ('Professional Development', 'professional-development', 'Continuous learning and growth', 7)
ON CONFLICT (slug) DO NOTHING;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_article_categories_active ON public.article_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_article_categories_order ON public.article_categories(display_order);

-- Update articles table to reference categories table (optional - for referential integrity)
-- Note: We'll keep the category as text for flexibility, but you could change this to a foreign key
-- ALTER TABLE public.articles ADD CONSTRAINT fk_articles_category 
-- FOREIGN KEY (category) REFERENCES public.article_categories(slug) ON DELETE SET NULL;
