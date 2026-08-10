-- Offseason Decisions Migration
-- Adds support for the three decision points before the draft

-- Add contract_status to track player situation
-- 'active' = under contract for 2026+
-- 'expired' = contract ended, eligible for franchise tag
-- 'free_agent_pickup' = picked up mid-season, no contract
ALTER TABLE salarycap_contracts
ADD COLUMN IF NOT EXISTS contract_status TEXT DEFAULT 'active';

-- Add offseason_decision to track owner's choice
-- 'pending' = no decision made yet
-- 'keep' = keeping player under contract
-- 'cut' = cutting player (incurs dead cap)
-- 'franchise_tag' = applying franchise tag (expired contracts only)
-- 'sign_fa' = signing free agent pickup for $5
-- 'release' = releasing to auction pool
ALTER TABLE salarycap_contracts
ADD COLUMN IF NOT EXISTS offseason_decision TEXT DEFAULT 'pending';

-- Add dead_cap_if_cut to pre-calculate what cutting would cost
ALTER TABLE salarycap_contracts
ADD COLUMN IF NOT EXISTS dead_cap_if_cut DECIMAL(10,2) DEFAULT 0;

-- Create table for free agent pickups (players on roster without contracts)
-- These need separate tracking since they don't have traditional contracts
CREATE TABLE IF NOT EXISTS salarycap_free_agent_pickups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES salarycap_players(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES salarycap_owners(id) ON DELETE CASCADE,
  offseason_decision TEXT DEFAULT 'pending', -- 'pending', 'sign_fa', 'release'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (player_id)
);

-- Create table to track team offseason completion status
CREATE TABLE IF NOT EXISTS salarycap_offseason_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES salarycap_owners(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  cuts_completed BOOLEAN DEFAULT FALSE,
  franchise_tag_completed BOOLEAN DEFAULT FALSE,
  free_agents_completed BOOLEAN DEFAULT FALSE,
  all_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (owner_id, season)
);

-- Enable RLS
ALTER TABLE salarycap_free_agent_pickups ENABLE ROW LEVEL SECURITY;
ALTER TABLE salarycap_offseason_status ENABLE ROW LEVEL SECURITY;

-- RLS policies for free agent pickups
CREATE POLICY "Authenticated can view salarycap_free_agent_pickups" ON salarycap_free_agent_pickups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage salarycap_free_agent_pickups" ON salarycap_free_agent_pickups
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
-- Owners can update their own free agent decisions
CREATE POLICY "Owners can update own free_agent_pickups" ON salarycap_free_agent_pickups
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM salarycap_owners
      WHERE salarycap_owners.id = salarycap_free_agent_pickups.owner_id
      AND salarycap_owners.profile_id = auth.uid()
    )
  );

-- RLS policies for offseason status
CREATE POLICY "Authenticated can view salarycap_offseason_status" ON salarycap_offseason_status
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage salarycap_offseason_status" ON salarycap_offseason_status
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
-- Owners can update their own offseason status
CREATE POLICY "Owners can update own offseason_status" ON salarycap_offseason_status
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM salarycap_owners
      WHERE salarycap_owners.id = salarycap_offseason_status.owner_id
      AND salarycap_owners.profile_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_salarycap_contracts_status ON salarycap_contracts(contract_status);
CREATE INDEX IF NOT EXISTS idx_salarycap_contracts_decision ON salarycap_contracts(offseason_decision);
CREATE INDEX IF NOT EXISTS idx_salarycap_fa_pickups_owner ON salarycap_free_agent_pickups(owner_id);
CREATE INDEX IF NOT EXISTS idx_salarycap_offseason_status_owner ON salarycap_offseason_status(owner_id);

-- Allow owners to update their own contracts (for offseason decisions)
CREATE POLICY "Owners can update own contracts" ON salarycap_contracts
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM salarycap_owners
      WHERE salarycap_owners.id = salarycap_contracts.owner_id
      AND salarycap_owners.profile_id = auth.uid()
    )
  );
