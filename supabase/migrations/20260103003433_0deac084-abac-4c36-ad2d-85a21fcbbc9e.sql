-- Create article_reports table for employees to report issues
CREATE TABLE public.article_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  reporter_user_id uuid NOT NULL,
  report_type text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.article_reports ENABLE ROW LEVEL SECURITY;

-- Employees can create reports
CREATE POLICY "Employees can create reports"
ON public.article_reports
FOR INSERT
WITH CHECK (
  auth.uid() = reporter_user_id 
  AND has_role(auth.uid(), 'employee'::app_role)
);

-- Users can view their own reports
CREATE POLICY "Users can view their own reports"
ON public.article_reports
FOR SELECT
USING (auth.uid() = reporter_user_id);

-- Admins can view all reports
CREATE POLICY "Admins can view all reports"
ON public.article_reports
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update reports
CREATE POLICY "Admins can update reports"
ON public.article_reports
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete reports
CREATE POLICY "Admins can delete reports"
ON public.article_reports
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_article_reports_updated_at
BEFORE UPDATE ON public.article_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();