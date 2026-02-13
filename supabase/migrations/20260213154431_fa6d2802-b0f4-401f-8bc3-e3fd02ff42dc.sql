
-- A) 1) Add hiring_style and hiring_config to jobs table
ALTER TABLE public.jobs
  ADD COLUMN hiring_style text NOT NULL DEFAULT 'slot_1to1',
  ADD COLUMN hiring_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Add check constraint via trigger (immutable requirement)
CREATE OR REPLACE FUNCTION public.validate_hiring_style()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.hiring_style NOT IN ('slot_1to1', 'open_ai_top10') THEN
    RAISE EXCEPTION 'Invalid hiring_style: %. Must be slot_1to1 or open_ai_top10', NEW.hiring_style;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_hiring_style
  BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_hiring_style();

-- A) 2) job_ai_questionnaires table
CREATE TABLE public.job_ai_questionnaires (
  job_id uuid PRIMARY KEY REFERENCES public.jobs(id) ON DELETE CASCADE,
  questionnaire jsonb NOT NULL,
  model text NOT NULL,
  prompt_version text NOT NULL DEFAULT 'qgen_v1',
  generated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_ai_questionnaires ENABLE ROW LEVEL SECURITY;

-- Only service-role can INSERT/UPDATE/DELETE (no policies = denied for anon/authenticated)
-- Contractors can SELECT for their own jobs
CREATE POLICY "Contractors can view questionnaires for own jobs"
  ON public.job_ai_questionnaires
  FOR SELECT
  USING (job_id IN (
    SELECT j.id FROM public.jobs j
    JOIN public.contractor_profiles cp ON cp.id = j.contractor_id
    WHERE cp.user_id = auth.uid()
  ));

-- A) 3) Extend job_applications with AI scoring columns
ALTER TABLE public.job_applications
  ADD COLUMN application_answers jsonb NULL,
  ADD COLUMN ai_scoring_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN ai_score numeric(5,2) NULL,
  ADD COLUMN ai_score_updated_at timestamptz NULL,
  ADD COLUMN ai_reason_summary text NULL;

-- Validate ai_scoring_status via trigger
CREATE OR REPLACE FUNCTION public.validate_ai_scoring_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.ai_scoring_status NOT IN ('pending', 'processing', 'scored', 'failed') THEN
    RAISE EXCEPTION 'Invalid ai_scoring_status: %. Must be pending, processing, scored, or failed', NEW.ai_scoring_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_ai_scoring_status
  BEFORE INSERT OR UPDATE ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_ai_scoring_status();

-- A) 4) job_top_candidates table
CREATE TABLE public.job_top_candidates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  job_application_id uuid NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  rank integer NOT NULL,
  score numeric(5,2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_id, rank),
  UNIQUE(job_id, job_application_id)
);

-- Validate rank via trigger
CREATE OR REPLACE FUNCTION public.validate_top_candidate_rank()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.rank < 1 OR NEW.rank > 25 THEN
    RAISE EXCEPTION 'rank must be between 1 and 25, got %', NEW.rank;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_top_candidate_rank
  BEFORE INSERT OR UPDATE ON public.job_top_candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_top_candidate_rank();

ALTER TABLE public.job_top_candidates ENABLE ROW LEVEL SECURITY;

-- B) RLS: Contractors can SELECT job_top_candidates only for jobs they own
CREATE POLICY "Contractors can view top candidates for own jobs"
  ON public.job_top_candidates
  FOR SELECT
  USING (job_id IN (
    SELECT j.id FROM public.jobs j
    JOIN public.contractor_profiles cp ON cp.id = j.contractor_id
    WHERE cp.user_id = auth.uid()
  ));

-- Admins can view all top candidates
CREATE POLICY "Admins can view all top candidates"
  ON public.job_top_candidates
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
