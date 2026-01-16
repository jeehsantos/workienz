-- Add columns to track entitlement deactivation and credit application
ALTER TABLE contractor_entitlements 
ADD COLUMN IF NOT EXISTS deactivated_reason TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS credit_applied_to_entitlement_id UUID DEFAULT NULL;

-- Add a constraint to reference the new entitlement
ALTER TABLE contractor_entitlements
ADD CONSTRAINT fk_credit_applied_to_entitlement
FOREIGN KEY (credit_applied_to_entitlement_id) 
REFERENCES contractor_entitlements(id)
ON DELETE SET NULL;