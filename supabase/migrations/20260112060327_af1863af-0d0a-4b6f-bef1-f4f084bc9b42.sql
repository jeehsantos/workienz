-- Create platform_settings table for configurable settings like max positions per job
CREATE TABLE public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default setting for max positions per job
INSERT INTO public.platform_settings (setting_key, setting_value, description)
VALUES ('max_positions_per_job', '10', 'Maximum number of positions available per job posting');

-- Enable Row Level Security
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read settings
CREATE POLICY "Anyone can read settings" 
ON public.platform_settings 
FOR SELECT 
TO authenticated
USING (true);

-- Only admins can modify settings
CREATE POLICY "Only admins can modify settings" 
ON public.platform_settings 
FOR ALL 
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Add trigger for updating updated_at
CREATE TRIGGER update_platform_settings_updated_at
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();