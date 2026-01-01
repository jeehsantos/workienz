-- Add 2FA columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS two_factor_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS two_factor_secret text,
ADD COLUMN IF NOT EXISTS two_factor_backup_codes text[];

-- Add RLS policy for 2FA columns (users can only see/update their own)
-- The existing policies already cover this since they use auth.uid() = user_id