-- Add application throttling settings to platform_settings
INSERT INTO platform_settings (setting_key, setting_value, description) VALUES
  ('free_tier_cooldown_days', '3', 'Number of days free users must wait between job applications'),
  ('paid_tier_max_active_apps', '3', 'Maximum number of active (pending/shortlisted) applications for subscribed users'),
  ('paid_tier_cooldown_days', '3', 'Number of days subscribed users must wait between new applications')
ON CONFLICT DO NOTHING;

-- Add last_application_date to employee_profiles for tracking cooldown
ALTER TABLE employee_profiles ADD COLUMN IF NOT EXISTS last_application_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add wizard_step to jobs table for tracking wizard progress on drafts
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS wizard_step INTEGER DEFAULT 1;

-- Update the jobs table to store form_data as JSONB for wizard state persistence
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS form_data JSONB DEFAULT NULL;