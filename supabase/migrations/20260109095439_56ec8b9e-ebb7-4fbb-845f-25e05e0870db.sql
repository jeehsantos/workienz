-- First, deduplicate any existing subscriptions (keep the most recent per user)
DELETE FROM public.subscriptions
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC, created_at DESC) as rn
    FROM public.subscriptions
  ) ranked
  WHERE rn > 1
);

-- Add unique constraint on user_id to support upsert with onConflict
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_id_key ON public.subscriptions(user_id);