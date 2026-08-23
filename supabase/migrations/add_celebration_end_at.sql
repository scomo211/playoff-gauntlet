-- Add celebration_end_at column to salarycap_auction_item table
-- This allows all clients to see the same celebration period after a player is sold

ALTER TABLE salarycap_auction_item
ADD COLUMN IF NOT EXISTS celebration_end_at TIMESTAMPTZ;

COMMENT ON COLUMN salarycap_auction_item.celebration_end_at IS 'Timestamp when celebration period ends (typically 10 seconds after sale)';
