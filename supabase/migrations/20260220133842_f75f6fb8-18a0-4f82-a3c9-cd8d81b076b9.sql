
-- Create contractor notes per application
CREATE TABLE public.contractor_application_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_user_id UUID NOT NULL,
  application_id UUID NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (contractor_user_id, application_id)
);

-- Enable RLS
ALTER TABLE public.contractor_application_notes ENABLE ROW LEVEL SECURITY;

-- Contractors can view their own notes
CREATE POLICY "Contractors can view own application notes"
  ON public.contractor_application_notes
  FOR SELECT
  USING (auth.uid() = contractor_user_id);

-- Contractors can insert their own notes
CREATE POLICY "Contractors can insert own application notes"
  ON public.contractor_application_notes
  FOR INSERT
  WITH CHECK (auth.uid() = contractor_user_id AND has_role(auth.uid(), 'contractor'::app_role));

-- Contractors can update their own notes
CREATE POLICY "Contractors can update own application notes"
  ON public.contractor_application_notes
  FOR UPDATE
  USING (auth.uid() = contractor_user_id);

-- Contractors can delete their own notes
CREATE POLICY "Contractors can delete own application notes"
  ON public.contractor_application_notes
  FOR DELETE
  USING (auth.uid() = contractor_user_id);

-- Auto-update updated_at
CREATE TRIGGER update_contractor_application_notes_updated_at
  BEFORE UPDATE ON public.contractor_application_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
