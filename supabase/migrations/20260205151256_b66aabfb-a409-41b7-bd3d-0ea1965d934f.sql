-- Allow logged-out visitors (anon) to read ONLY the hide_upgrade_buttons flag
-- so public pages (like /pricing) can hide upgrade-related sections.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'platform_settings'
      AND policyname = 'Anon can read hide_upgrade_buttons'
  ) THEN
    CREATE POLICY "Anon can read hide_upgrade_buttons"
    ON public.platform_settings
    FOR SELECT
    TO anon
    USING (setting_key = 'hide_upgrade_buttons');
  END IF;
END $$;