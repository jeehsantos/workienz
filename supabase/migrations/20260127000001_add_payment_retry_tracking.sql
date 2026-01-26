-- Create table to track payment retry attempts
CREATE TABLE IF NOT EXISTS payment_retry_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT,
  stripe_subscription_id TEXT,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'retrying', 'succeeded', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_payment_retry_user_id ON payment_retry_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_retry_status ON payment_retry_attempts(status);
CREATE INDEX IF NOT EXISTS idx_payment_retry_next_retry ON payment_retry_attempts(next_retry_at) WHERE status = 'retrying';
CREATE INDEX IF NOT EXISTS idx_payment_retry_stripe_payment_intent ON payment_retry_attempts(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payment_retry_stripe_subscription ON payment_retry_attempts(stripe_subscription_id);

-- Add RLS policies
ALTER TABLE payment_retry_attempts ENABLE ROW LEVEL SECURITY;

-- Users can view their own retry attempts
CREATE POLICY "Users can view own payment retry attempts"
  ON payment_retry_attempts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can manage all retry attempts
CREATE POLICY "Service role can manage payment retry attempts"
  ON payment_retry_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_payment_retry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_retry_updated_at
  BEFORE UPDATE ON payment_retry_attempts
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_retry_updated_at();

-- Add comment
COMMENT ON TABLE payment_retry_attempts IS 'Tracks payment retry attempts with exponential backoff for failed payments';
