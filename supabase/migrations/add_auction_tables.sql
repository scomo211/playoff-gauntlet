-- Live Auction Draft System Tables
-- This migration adds tables for real-time auction drafting

-- Main auction session
CREATE TABLE IF NOT EXISTS salarycap_auction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'completed')),
  nomination_order UUID[] NOT NULL, -- Array of owner_ids in draft order
  current_nominator_index INT DEFAULT 0,
  total_nominations INT DEFAULT 0,
  -- Timer settings (change after 50 nominations)
  timer_duration INT DEFAULT 30,
  timer_reset_threshold INT DEFAULT 10,
  timer_reset_to INT DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Currently active auction item (one at a time)
CREATE TABLE IF NOT EXISTS salarycap_auction_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID REFERENCES salarycap_auction(id) ON DELETE CASCADE,
  player_id UUID REFERENCES salarycap_players(id),
  nominated_by UUID REFERENCES salarycap_owners(id),
  opening_bid INT NOT NULL,
  current_bid INT NOT NULL,
  current_high_bidder UUID REFERENCES salarycap_owners(id),
  timer_end_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'passed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bid history for audit trail
CREATE TABLE IF NOT EXISTS salarycap_auction_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_item_id UUID REFERENCES salarycap_auction_item(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES salarycap_owners(id),
  amount INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Final results (winners)
CREATE TABLE IF NOT EXISTS salarycap_auction_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID REFERENCES salarycap_auction(id) ON DELETE CASCADE,
  player_id UUID REFERENCES salarycap_players(id),
  winner_id UUID REFERENCES salarycap_owners(id),
  winning_bid INT NOT NULL,
  contract_years INT, -- NULL until owner assigns post-draft
  nomination_number INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_auction_item_auction ON salarycap_auction_item(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_item_status ON salarycap_auction_item(status);
CREATE INDEX IF NOT EXISTS idx_auction_results_winner ON salarycap_auction_results(winner_id);
CREATE INDEX IF NOT EXISTS idx_auction_results_auction ON salarycap_auction_results(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_item ON salarycap_auction_bids(auction_item_id);

-- Enable realtime for auction tables
ALTER PUBLICATION supabase_realtime ADD TABLE salarycap_auction;
ALTER PUBLICATION supabase_realtime ADD TABLE salarycap_auction_item;
ALTER PUBLICATION supabase_realtime ADD TABLE salarycap_auction_bids;
ALTER PUBLICATION supabase_realtime ADD TABLE salarycap_auction_results;

-- RLS Policies

-- Auction table: anyone can read, only admins can modify
ALTER TABLE salarycap_auction ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view auctions"
  ON salarycap_auction FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage auctions"
  ON salarycap_auction FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Auction items: anyone can read, service role for modifications
ALTER TABLE salarycap_auction_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view auction items"
  ON salarycap_auction_item FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage auction items"
  ON salarycap_auction_item FOR ALL
  USING (auth.role() = 'service_role');

-- Auction bids: anyone can read, service role for inserts
ALTER TABLE salarycap_auction_bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view bids"
  ON salarycap_auction_bids FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert bids"
  ON salarycap_auction_bids FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Auction results: anyone can read, service role for modifications
ALTER TABLE salarycap_auction_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view results"
  ON salarycap_auction_results FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage results"
  ON salarycap_auction_results FOR ALL
  USING (auth.role() = 'service_role');
