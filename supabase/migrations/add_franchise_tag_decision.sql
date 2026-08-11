-- Add franchise_tag_decision to salarycap_owners
-- This tracks whether an owner has made their franchise tag decision
-- Values: 'pending' (default), 'tagged' (used tag), 'skipped' (explicitly skipped)

ALTER TABLE salarycap_owners
ADD COLUMN IF NOT EXISTS franchise_tag_decision TEXT DEFAULT 'pending';

-- Comment for documentation
COMMENT ON COLUMN salarycap_owners.franchise_tag_decision IS 'Tracks franchise tag decision: pending, tagged, or skipped';
