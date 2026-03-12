
-- Create contractor_talent_pool_members table
CREATE TABLE public.contractor_talent_pool_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  category TEXT NOT NULL,
  source_job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  source_application_id UUID REFERENCES public.job_applications(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (contractor_id, employee_id, category)
);

-- Validate status values
CREATE OR REPLACE FUNCTION public.validate_pool_member_status()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('active', 'removed_by_contractor', 'left_by_worker') THEN
    RAISE EXCEPTION 'Invalid pool member status: %. Must be active, removed_by_contractor, or left_by_worker', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_pool_member_status
  BEFORE INSERT OR UPDATE ON public.contractor_talent_pool_members
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_pool_member_status();

-- Indexes
CREATE INDEX idx_pool_members_contractor_category_status ON public.contractor_talent_pool_members (contractor_id, category, status);
CREATE INDEX idx_pool_members_employee_status ON public.contractor_talent_pool_members (employee_id, status);

-- Enable RLS
ALTER TABLE public.contractor_talent_pool_members ENABLE ROW LEVEL SECURITY;

-- RLS: Contractors can view their own pool members
CREATE POLICY "Contractors can view own pool members"
  ON public.contractor_talent_pool_members
  FOR SELECT
  USING (
    contractor_id IN (
      SELECT cp.user_id FROM public.contractor_profiles cp WHERE cp.user_id = auth.uid()
    )
  );

-- RLS: Contractors can insert their own pool members
CREATE POLICY "Contractors can insert own pool members"
  ON public.contractor_talent_pool_members
  FOR INSERT
  WITH CHECK (
    contractor_id IN (
      SELECT cp.user_id FROM public.contractor_profiles cp WHERE cp.user_id = auth.uid()
    )
    AND has_role(auth.uid(), 'contractor')
  );

-- RLS: Contractors can update their own pool members
CREATE POLICY "Contractors can update own pool members"
  ON public.contractor_talent_pool_members
  FOR UPDATE
  USING (
    contractor_id IN (
      SELECT cp.user_id FROM public.contractor_profiles cp WHERE cp.user_id = auth.uid()
    )
  );

-- RLS: Contractors can delete their own pool members
CREATE POLICY "Contractors can delete own pool members"
  ON public.contractor_talent_pool_members
  FOR DELETE
  USING (
    contractor_id IN (
      SELECT cp.user_id FROM public.contractor_profiles cp WHERE cp.user_id = auth.uid()
    )
  );

-- RLS: Employees can view their own pool memberships
CREATE POLICY "Employees can view own pool memberships"
  ON public.contractor_talent_pool_members
  FOR SELECT
  USING (
    employee_id IN (
      SELECT ep.user_id FROM public.employee_profiles ep WHERE ep.user_id = auth.uid()
    )
  );

-- RLS: Employees can update their own memberships (to leave pool)
CREATE POLICY "Employees can update own pool memberships"
  ON public.contractor_talent_pool_members
  FOR UPDATE
  USING (
    employee_id IN (
      SELECT ep.user_id FROM public.employee_profiles ep WHERE ep.user_id = auth.uid()
    )
  );

-- RLS: Admins can manage all pool members
CREATE POLICY "Admins can manage all pool members"
  ON public.contractor_talent_pool_members
  FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE TRIGGER update_pool_members_updated_at
  BEFORE UPDATE ON public.contractor_talent_pool_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
