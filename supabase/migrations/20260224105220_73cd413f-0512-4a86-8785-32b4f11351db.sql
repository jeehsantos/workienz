
-- ============================================================
-- A) CONTRACTOR PRE-EMPLOYMENT TEMPLATES TABLE
-- ============================================================
CREATE TABLE public.contractor_pre_employment_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL,
  name text NOT NULL,
  template_schema jsonb NOT NULL DEFAULT '{"sections":[]}'::jsonb,
  version text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contractor_pre_employment_templates ENABLE ROW LEVEL SECURITY;

-- RLS: Contractors CRUD their own templates only
CREATE POLICY "Contractors can view own templates"
  ON public.contractor_pre_employment_templates FOR SELECT
  USING (auth.uid() = contractor_id);

CREATE POLICY "Contractors can insert own templates"
  ON public.contractor_pre_employment_templates FOR INSERT
  WITH CHECK (auth.uid() = contractor_id AND has_role(auth.uid(), 'contractor'::app_role));

CREATE POLICY "Contractors can update own templates"
  ON public.contractor_pre_employment_templates FOR UPDATE
  USING (auth.uid() = contractor_id);

CREATE POLICY "Contractors can delete own templates"
  ON public.contractor_pre_employment_templates FOR DELETE
  USING (auth.uid() = contractor_id);

-- Admins can manage all
CREATE POLICY "Admins can manage all templates"
  ON public.contractor_pre_employment_templates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Updated_at trigger
CREATE TRIGGER update_contractor_templates_updated_at
  BEFORE UPDATE ON public.contractor_pre_employment_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- B) MODIFY application_pre_employment_packs
-- ============================================================

-- Add template reference
ALTER TABLE public.application_pre_employment_packs
  ADD COLUMN template_id uuid REFERENCES public.contractor_pre_employment_templates(id);

-- Add encrypted answers storage (replaces plain JSON answers)
ALTER TABLE public.application_pre_employment_packs
  ADD COLUMN answers_encrypted bytea,
  ADD COLUMN encryption_version text DEFAULT 'aes-256-gcm-v1';

-- Add download/expiry tracking
ALTER TABLE public.application_pre_employment_packs
  ADD COLUMN downloaded_at timestamptz,
  ADD COLUMN expires_at timestamptz;

-- ============================================================
-- D) SCHEMA VALIDATION TRIGGER FOR TEMPLATES
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_template_schema()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  -- Must have sections array
  IF NOT (NEW.template_schema ? 'sections') THEN
    RAISE EXCEPTION 'template_schema must contain a "sections" array';
  END IF;
  IF jsonb_typeof(NEW.template_schema -> 'sections') != 'array' THEN
    RAISE EXCEPTION 'template_schema.sections must be an array';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_template_schema_trigger
  BEFORE INSERT OR UPDATE ON public.contractor_pre_employment_templates
  FOR EACH ROW EXECUTE FUNCTION public.validate_template_schema();
