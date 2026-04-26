INSERT INTO public.platform_settings (setting_key, setting_value, description)
VALUES ('nzbn_verification_enabled', 'false', 'When true, contractors must verify their NZBN with the MBIE NZBN Register before publishing jobs. Disable while awaiting NZBN API approval or to make verification optional.')
ON CONFLICT (setting_key) DO NOTHING;