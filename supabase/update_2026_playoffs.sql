-- 2025-26 NFL Playoffs Update
-- Run this SQL in Supabase SQL Editor

-- ============================================
-- 1. Add playoff_seed column to teams
-- ============================================
ALTER TABLE teams ADD COLUMN IF NOT EXISTS playoff_seed INTEGER;

-- ============================================
-- 2. Mark teams NOT in 2025-26 playoffs
-- ============================================
UPDATE teams SET is_alive = false, eliminated_week = 0 WHERE id IN ('BAL', 'DET', 'KC', 'MIN', 'TB', 'WAS');

-- ============================================
-- 3. Update seeds for existing playoff teams
-- ============================================
UPDATE teams SET playoff_seed = 6 WHERE id = 'BUF';  -- AFC 6
UPDATE teams SET playoff_seed = 1 WHERE id = 'DEN';  -- AFC 1 (bye)
UPDATE teams SET playoff_seed = 7 WHERE id = 'GB';   -- NFC 7
UPDATE teams SET playoff_seed = 5 WHERE id = 'HOU';  -- AFC 5
UPDATE teams SET playoff_seed = 7 WHERE id = 'LAC';  -- AFC 7
UPDATE teams SET playoff_seed = 5 WHERE id = 'LAR';  -- NFC 5
UPDATE teams SET playoff_seed = 3 WHERE id = 'PHI';  -- NFC 3
UPDATE teams SET playoff_seed = 4 WHERE id = 'PIT';  -- AFC 4

-- ============================================
-- 4. Add missing 2025-26 playoff teams
-- ============================================
INSERT INTO teams (id, name, city, conference, playoff_seed, is_alive) VALUES
  ('NE', 'Patriots', 'New England', 'AFC', 2, true),
  ('JAX', 'Jaguars', 'Jacksonville', 'AFC', 3, true),
  ('SEA', 'Seahawks', 'Seattle', 'NFC', 1, true),
  ('CHI', 'Bears', 'Chicago', 'NFC', 2, true),
  ('CAR', 'Panthers', 'Carolina', 'NFC', 4, true),
  ('SF', '49ers', 'San Francisco', 'NFC', 6, true)
ON CONFLICT (id) DO UPDATE SET
  playoff_seed = EXCLUDED.playoff_seed,
  is_alive = true;

-- ============================================
-- 5. Mark players from eliminated teams as inactive
-- ============================================
UPDATE players SET is_active = false WHERE team_id IN ('BAL', 'DET', 'KC', 'MIN', 'TB', 'WAS');
