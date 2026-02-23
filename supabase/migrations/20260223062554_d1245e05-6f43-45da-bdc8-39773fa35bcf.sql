
-- AI usage ledger for tracking AI consumption per contractor/job
CREATE TABLE public.contractor_ai_usage_ledger (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_user_id uuid NOT NULL,
  job_id uuid NOT NULL,
  event_type text NOT NULL,
  count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for event_type
CREATE OR REPLACE FUNCTION public.validate_ai_usage_event_type()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.event_type NOT IN ('questionnaire_generated', 'application_scored') THEN
    RAISE EXCEPTION 'Invalid event_type: %. Must be questionnaire_generated or application_scored', NEW.event_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_ai_usage_event_type
  BEFORE INSERT OR UPDATE ON public.contractor_ai_usage_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_ai_usage_event_type();

-- Indexes
CREATE INDEX idx_ai_usage_contractor ON public.contractor_ai_usage_ledger (contractor_user_id);
CREATE INDEX idx_ai_usage_job ON public.contractor_ai_usage_ledger (job_id);
CREATE INDEX idx_ai_usage_event ON public.contractor_ai_usage_ledger (event_type, created_at);

-- Enable RLS
ALTER TABLE public.contractor_ai_usage_ledger ENABLE ROW LEVEL SECURITY;

-- Contractors can view their own usage
CREATE POLICY "Contractors can view own AI usage"
  ON public.contractor_ai_usage_ledger
  FOR SELECT
  TO authenticated
  USING (auth.uid() = contractor_user_id);

-- Admins can view all
CREATE POLICY "Admins can view all AI usage"
  ON public.contractor_ai_usage_ledger
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can manage all
CREATE POLICY "Admins can manage all AI usage"
  ON public.contractor_ai_usage_ledger
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
