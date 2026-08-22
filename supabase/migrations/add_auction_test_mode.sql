-- Add test mode support for auctions
-- Allows running test/practice auctions that can be fully reset

-- Add test mode flag
ALTER TABLE salarycap_auction ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;

-- Add bot owner IDs array (tracks which owners are bots in this auction)
ALTER TABLE salarycap_auction ADD COLUMN IF NOT EXISTS bot_owner_ids UUID[] DEFAULT '{}';

-- Index for finding test auctions
CREATE INDEX IF NOT EXISTS idx_auction_is_test ON salarycap_auction(is_test);
