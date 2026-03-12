
-- Shift assignments: links a talent pool member to a specific shift
CREATE TABLE public.shift_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.job_shifts(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  employee_user_id uuid NOT NULL,
  assigned_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'assigned',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shift_id, employee_user_id)
);

-- Validate status values
CREATE OR REPLACE FUNCTION public.validate_shift_assignment_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('assigned', 'confirmed', 'declined', 'no_show', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid shift assignment status: %. Must be assigned, confirmed, declined, no_show, completed, or cancelled', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_shift_assignment_status
BEFORE INSERT OR UPDATE ON public.shift_assignments
FOR EACH ROW EXECUTE FUNCTION public.validate_shift_assignment_status();

-- Updated_at trigger
CREATE TRIGGER update_shift_assignments_updated_at
BEFORE UPDATE ON public.shift_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_shift_assignments_shift_id ON public.shift_assignments(shift_id);
CREATE INDEX idx_shift_assignments_job_id ON public.shift_assignments(job_id);
CREATE INDEX idx_shift_assignments_employee ON public.shift_assignments(employee_user_id);

-- RLS
ALTER TABLE public.shift_assignments ENABLE ROW LEVEL SECURITY;

-- Contractors can manage assignments for their own jobs
CREATE POLICY "Contractors can view own job shift assignments"
ON public.shift_assignments FOR SELECT
USING (
  job_id IN (
    SELECT j.id FROM jobs j
    JOIN contractor_profiles cp ON cp.id = j.contractor_id
    WHERE cp.user_id = auth.uid()
  )
);

CREATE POLICY "Contractors can insert own job shift assignments"
ON public.shift_assignments FOR INSERT
WITH CHECK (
  assigned_by = auth.uid()
  AND job_id IN (
    SELECT j.id FROM jobs j
    JOIN contractor_profiles cp ON cp.id = j.contractor_id
    WHERE cp.user_id = auth.uid()
  )
);

CREATE POLICY "Contractors can update own job shift assignments"
ON public.shift_assignments FOR UPDATE
USING (
  job_id IN (
    SELECT j.id FROM jobs j
    JOIN contractor_profiles cp ON cp.id = j.contractor_id
    WHERE cp.user_id = auth.uid()
  )
);

CREATE POLICY "Contractors can delete own job shift assignments"
ON public.shift_assignments FOR DELETE
USING (
  job_id IN (
    SELECT j.id FROM jobs j
    JOIN contractor_profiles cp ON cp.id = j.contractor_id
    WHERE cp.user_id = auth.uid()
  )
);

-- Employees can view their own assignments
CREATE POLICY "Employees can view own shift assignments"
ON public.shift_assignments FOR SELECT
USING (employee_user_id = auth.uid());

-- Employees can update their own assignments (e.g., confirm/decline)
CREATE POLICY "Employees can update own shift assignments"
ON public.shift_assignments FOR UPDATE
USING (employee_user_id = auth.uid());

-- Admins full access
CREATE POLICY "Admins can manage all shift assignments"
ON public.shift_assignments FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
