-- Playoff Gauntlet Seed Data
-- Run this AFTER schema.sql

-- ============================================
-- WEEKS (2024-2025 NFL Playoffs)
-- ============================================
INSERT INTO weeks (id, name, roster_size, lockout_time, is_current, is_complete) VALUES
(1, 'Wild Card', 15, '2025-01-11 13:30:00-05', TRUE, FALSE),
(2, 'Divisional', 15, '2025-01-18 16:30:00-05', FALSE, FALSE),
(3, 'Conference Championships', 15, '2025-01-26 15:00:00-05', FALSE, FALSE),
(4, 'Super Bowl', 8, '2025-02-09 18:30:00-05', FALSE, FALSE);

-- ============================================
-- ROSTER REQUIREMENTS
-- ============================================
-- Weeks 1-3: 15 players
INSERT INTO roster_requirements (week_id, position, slots_required) VALUES
(1, 'QB', 2), (1, 'RB', 3), (1, 'WR', 4), (1, 'TE', 2), (1, 'K', 2), (1, 'DEF', 2),
(2, 'QB', 2), (2, 'RB', 3), (2, 'WR', 4), (2, 'TE', 2), (2, 'K', 2), (2, 'DEF', 2),
(3, 'QB', 2), (3, 'RB', 3), (3, 'WR', 4), (3, 'TE', 2), (3, 'K', 2), (3, 'DEF', 2),
-- Week 4 (Super Bowl): 8 players
(4, 'QB', 1), (4, 'RB', 2), (4, 'WR', 2), (4, 'TE', 1), (4, 'K', 1), (4, 'DEF', 1);

-- ============================================
-- NFL PLAYOFF TEAMS (2024-2025 Season)
-- ============================================
INSERT INTO teams (id, name, city, conference, is_alive) VALUES
-- AFC
('KC', 'Chiefs', 'Kansas City', 'AFC', TRUE),
('BUF', 'Bills', 'Buffalo', 'AFC', TRUE),
('BAL', 'Ravens', 'Baltimore', 'AFC', TRUE),
('HOU', 'Texans', 'Houston', 'AFC', TRUE),
('LAC', 'Chargers', 'Los Angeles', 'AFC', TRUE),
('PIT', 'Steelers', 'Pittsburgh', 'AFC', TRUE),
('DEN', 'Broncos', 'Denver', 'AFC', TRUE),
-- NFC
('DET', 'Lions', 'Detroit', 'NFC', TRUE),
('PHI', 'Eagles', 'Philadelphia', 'NFC', TRUE),
('TB', 'Buccaneers', 'Tampa Bay', 'NFC', TRUE),
('LAR', 'Rams', 'Los Angeles', 'NFC', TRUE),
('MIN', 'Vikings', 'Minnesota', 'NFC', TRUE),
('WAS', 'Commanders', 'Washington', 'NFC', TRUE),
('GB', 'Packers', 'Green Bay', 'NFC', TRUE);

-- ============================================
-- LEAGUE SETTINGS
-- ============================================
INSERT INTO league_settings (id, entries_locked, entry_fee, current_week_id)
VALUES (1, FALSE, 25.00, 1);
