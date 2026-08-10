-- Salary Cap Fantasy Football Module Migration
-- Run this in Supabase SQL Editor to add all salary cap tables
--
-- This is a standalone migration that adds the Bobby 3-Stix Memorial
-- Salary Cap League module without affecting existing Playoff Gauntlet data

-- ============================================
-- SALARY CAP SETTINGS (singleton)
-- ============================================
CREATE TABLE IF NOT EXISTS salarycap_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  league_name TEXT DEFAULT 'Bobby 3-Stix Memorial Salary Cap League',
  sleeper_league_id TEXT NOT NULL DEFAULT '1257102944021520384',
  salary_cap DECIMAL(10,2) DEFAULT 400.00,
  max_contract_years INTEGER DEFAULT 3,
  rookie_max_years INTEGER DEFAULT 5,
  dead_cap_percent DECIMAL(5,2) DEFAULT 40.00,
  fa_extension_base DECIMAL(10,2) DEFAULT 5.00,
  fa_extension_percent DECIMAL(5,2) DEFAULT 25.00,
  current_season INTEGER DEFAULT 2026,
  roster_size INTEGER DEFAULT 24,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SALARY CAP OWNERS (maps Sleeper users to profiles)
-- ============================================
CREATE TABLE IF NOT EXISTS salarycap_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sleeper_user_id TEXT UNIQUE NOT NULL,
  sleeper_display_name TEXT NOT NULL,
  sleeper_avatar TEXT,
  team_name TEXT,
  owner_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SALARY CAP PLAYERS (NFL players with Sleeper IDs)
-- ============================================
CREATE TABLE IF NOT EXISTS salarycap_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sleeper_player_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  nfl_team TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SALARY CAP CONTRACTS
-- ============================================
CREATE TABLE IF NOT EXISTS salarycap_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES salarycap_players(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES salarycap_owners(id) ON DELETE CASCADE,
  salary DECIMAL(10,2) NOT NULL,
  years_total INTEGER NOT NULL,
  years_remaining INTEGER NOT NULL,
  acquisition_type TEXT NOT NULL DEFAULT 'auction',
  acquisition_year INTEGER,
  is_franchise_tagged BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_active_player_contract UNIQUE (player_id)
);

-- ============================================
-- SALARY CAP ROSTERS (which players on which roster)
-- ============================================
CREATE TABLE IF NOT EXISTS salarycap_rosters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES salarycap_owners(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES salarycap_players(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (player_id)
);

-- ============================================
-- SALARY CAP DEAD CAP
-- ============================================
CREATE TABLE IF NOT EXISTS salarycap_dead_cap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES salarycap_owners(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  years_remaining INTEGER NOT NULL,
  original_salary DECIMAL(10,2) NOT NULL,
  cut_year INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SALARY CAP TRANSACTIONS (audit log)
-- ============================================
CREATE TABLE IF NOT EXISTS salarycap_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type TEXT NOT NULL,
  player_id UUID REFERENCES salarycap_players(id) ON DELETE SET NULL,
  player_name TEXT NOT NULL,
  from_owner_id UUID REFERENCES salarycap_owners(id),
  to_owner_id UUID REFERENCES salarycap_owners(id),
  salary DECIMAL(10,2),
  years INTEGER,
  dead_cap_amount DECIMAL(10,2),
  notes TEXT,
  transaction_date TIMESTAMPTZ DEFAULT NOW(),
  season INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SALARY CAP IMPORT STAGING (for reconciliation)
-- ============================================
CREATE TABLE IF NOT EXISTS salarycap_import_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id UUID NOT NULL,
  source TEXT NOT NULL,
  player_name TEXT,
  sleeper_player_id TEXT,
  owner_name TEXT,
  sleeper_user_id TEXT,
  position TEXT,
  salary DECIMAL(10,2),
  years_remaining INTEGER,
  years_total INTEGER,
  status TEXT DEFAULT 'pending',
  match_confidence DECIMAL(5,2),
  matched_player_id UUID REFERENCES salarycap_players(id),
  matched_owner_id UUID REFERENCES salarycap_owners(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SALARY CAP POSITION AVERAGES (for franchise tag)
-- ============================================
CREATE TABLE IF NOT EXISTS salarycap_position_averages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position TEXT NOT NULL,
  season INTEGER NOT NULL,
  avg_top_5_salary DECIMAL(10,2) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (position, season)
);

-- ============================================
-- SALARY CAP INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_salarycap_contracts_owner ON salarycap_contracts(owner_id);
CREATE INDEX IF NOT EXISTS idx_salarycap_contracts_player ON salarycap_contracts(player_id);
CREATE INDEX IF NOT EXISTS idx_salarycap_rosters_owner ON salarycap_rosters(owner_id);
CREATE INDEX IF NOT EXISTS idx_salarycap_players_sleeper_id ON salarycap_players(sleeper_player_id);
CREATE INDEX IF NOT EXISTS idx_salarycap_owners_sleeper_id ON salarycap_owners(sleeper_user_id);
CREATE INDEX IF NOT EXISTS idx_salarycap_owners_profile ON salarycap_owners(profile_id);
CREATE INDEX IF NOT EXISTS idx_salarycap_transactions_player ON salarycap_transactions(player_id);
CREATE INDEX IF NOT EXISTS idx_salarycap_transactions_date ON salarycap_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_salarycap_dead_cap_owner ON salarycap_dead_cap(owner_id);

-- ============================================
-- SALARY CAP ROW LEVEL SECURITY
-- ============================================
ALTER TABLE salarycap_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE salarycap_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE salarycap_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE salarycap_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE salarycap_rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE salarycap_dead_cap ENABLE ROW LEVEL SECURITY;
ALTER TABLE salarycap_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE salarycap_import_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE salarycap_position_averages ENABLE ROW LEVEL SECURITY;

-- Public read access for salary cap data
CREATE POLICY "Authenticated can view salarycap_settings" ON salarycap_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can view salarycap_owners" ON salarycap_owners
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can view salarycap_players" ON salarycap_players
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can view salarycap_contracts" ON salarycap_contracts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can view salarycap_rosters" ON salarycap_rosters
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can view salarycap_dead_cap" ON salarycap_dead_cap
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can view salarycap_transactions" ON salarycap_transactions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can view salarycap_position_averages" ON salarycap_position_averages
  FOR SELECT TO authenticated USING (true);

-- Admin full access for salary cap tables
CREATE POLICY "Admins can manage salarycap_settings" ON salarycap_settings
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
CREATE POLICY "Admins can manage salarycap_owners" ON salarycap_owners
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
CREATE POLICY "Admins can manage salarycap_players" ON salarycap_players
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
CREATE POLICY "Admins can manage salarycap_contracts" ON salarycap_contracts
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
CREATE POLICY "Admins can manage salarycap_rosters" ON salarycap_rosters
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
CREATE POLICY "Admins can manage salarycap_dead_cap" ON salarycap_dead_cap
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
CREATE POLICY "Admins can manage salarycap_transactions" ON salarycap_transactions
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
CREATE POLICY "Admins can manage salarycap_import_staging" ON salarycap_import_staging
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));
CREATE POLICY "Admins can manage salarycap_position_averages" ON salarycap_position_averages
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- ============================================
-- SALARY CAP HELPER FUNCTIONS
-- ============================================

-- Function to calculate dead cap for cutting a player
CREATE OR REPLACE FUNCTION calculate_dead_cap(
  p_salary DECIMAL,
  p_years_remaining INTEGER,
  p_dead_cap_percent DECIMAL DEFAULT 40.00
) RETURNS DECIMAL AS $$
BEGIN
  RETURN ROUND(p_salary * (p_dead_cap_percent / 100) * p_years_remaining, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate free agent extension cost
CREATE OR REPLACE FUNCTION calculate_fa_extension_cost(
  p_previous_salary DECIMAL,
  p_base_cost DECIMAL DEFAULT 5.00,
  p_percent DECIMAL DEFAULT 25.00
) RETURNS DECIMAL AS $$
BEGIN
  RETURN GREATEST(p_base_cost, ROUND(p_previous_salary * (p_percent / 100), 0));
END;
$$ LANGUAGE plpgsql;

-- Function to get owner's total salary
CREATE OR REPLACE FUNCTION get_owner_total_salary(p_owner_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  total DECIMAL;
BEGIN
  SELECT COALESCE(SUM(salary), 0) INTO total
  FROM salarycap_contracts
  WHERE owner_id = p_owner_id;
  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- Function to get owner's total dead cap
CREATE OR REPLACE FUNCTION get_owner_total_dead_cap(p_owner_id UUID, p_season INTEGER)
RETURNS DECIMAL AS $$
DECLARE
  total DECIMAL;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total
  FROM salarycap_dead_cap
  WHERE owner_id = p_owner_id
  AND years_remaining > 0;
  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- Function to get owner's cap space
CREATE OR REPLACE FUNCTION get_owner_cap_space(p_owner_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  cap_limit DECIMAL;
  total_salary DECIMAL;
  total_dead_cap DECIMAL;
BEGIN
  SELECT salary_cap INTO cap_limit FROM salarycap_settings WHERE id = 1;
  total_salary := get_owner_total_salary(p_owner_id);
  total_dead_cap := get_owner_total_dead_cap(p_owner_id, (SELECT current_season FROM salarycap_settings WHERE id = 1));
  RETURN cap_limit - total_salary - total_dead_cap;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Insert default settings if not exists
-- ============================================
INSERT INTO salarycap_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
