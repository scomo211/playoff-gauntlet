-- Salary Cap Bonus Cap Table Migration
-- Stores bonus cap transactions from trades between owners
-- Run this in Supabase SQL Editor

-- ============================================
-- SALARY CAP BONUS CAP TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS salarycap_bonus_cap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES salarycap_owners(id) ON DELETE CASCADE,
  corresponding_owner_id UUID REFERENCES salarycap_owners(id) ON DELETE SET NULL,
  corresponding_owner_name TEXT NOT NULL,  -- Store name for display/audit even if ID not matched
  trade_year INTEGER NOT NULL,
  amount_2026 DECIMAL(10,2) DEFAULT 0,
  amount_2027 DECIMAL(10,2) DEFAULT 0,
  amount_2028 DECIMAL(10,2) DEFAULT 0,
  amount_2029 DECIMAL(10,2) DEFAULT 0,
  amount_2030 DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_salarycap_bonus_cap_owner ON salarycap_bonus_cap(owner_id);
CREATE INDEX IF NOT EXISTS idx_salarycap_bonus_cap_corresponding ON salarycap_bonus_cap(corresponding_owner_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE salarycap_bonus_cap ENABLE ROW LEVEL SECURITY;

-- Public read access for authenticated users
CREATE POLICY "Authenticated can view salarycap_bonus_cap" ON salarycap_bonus_cap
  FOR SELECT TO authenticated USING (true);

-- Admin full access
CREATE POLICY "Admins can manage salarycap_bonus_cap" ON salarycap_bonus_cap
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- ============================================
-- HELPER FUNCTION: Get owner's net bonus cap for a season
-- ============================================
CREATE OR REPLACE FUNCTION get_owner_bonus_cap(p_owner_id UUID, p_season INTEGER)
RETURNS DECIMAL AS $$
DECLARE
  total DECIMAL;
BEGIN
  CASE p_season
    WHEN 2026 THEN
      SELECT COALESCE(SUM(amount_2026), 0) INTO total
      FROM salarycap_bonus_cap WHERE owner_id = p_owner_id;
    WHEN 2027 THEN
      SELECT COALESCE(SUM(amount_2027), 0) INTO total
      FROM salarycap_bonus_cap WHERE owner_id = p_owner_id;
    WHEN 2028 THEN
      SELECT COALESCE(SUM(amount_2028), 0) INTO total
      FROM salarycap_bonus_cap WHERE owner_id = p_owner_id;
    WHEN 2029 THEN
      SELECT COALESCE(SUM(amount_2029), 0) INTO total
      FROM salarycap_bonus_cap WHERE owner_id = p_owner_id;
    WHEN 2030 THEN
      SELECT COALESCE(SUM(amount_2030), 0) INTO total
      FROM salarycap_bonus_cap WHERE owner_id = p_owner_id;
    ELSE
      total := 0;
  END CASE;
  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- UPDATE: Modify get_owner_cap_space to include bonus cap
-- ============================================
CREATE OR REPLACE FUNCTION get_owner_cap_space(p_owner_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  cap_limit DECIMAL;
  total_salary DECIMAL;
  total_dead_cap DECIMAL;
  bonus_cap DECIMAL;
  current_season INTEGER;
BEGIN
  SELECT salary_cap, current_season INTO cap_limit, current_season
  FROM salarycap_settings WHERE id = 1;

  total_salary := get_owner_total_salary(p_owner_id);
  total_dead_cap := get_owner_total_dead_cap(p_owner_id, current_season);
  bonus_cap := get_owner_bonus_cap(p_owner_id, current_season);

  -- Bonus cap adds to (positive) or subtracts from (negative) available cap
  RETURN cap_limit + bonus_cap - total_salary - total_dead_cap;
END;
$$ LANGUAGE plpgsql;
