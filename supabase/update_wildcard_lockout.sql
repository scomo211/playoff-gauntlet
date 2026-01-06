-- Update Wild Card lockout_time to first game kickoff
-- First Wild Card game: Saturday, January 10, 2026 at 4:30 PM ET

-- Update Week 1 (Wild Card) lockout_time to kickoff of first game
UPDATE weeks
SET lockout_time = '2026-01-10T21:30:00+00:00'  -- 4:30 PM ET = 21:30 UTC
WHERE id = 1;

-- Verify the update
SELECT id, name, lockout_time, is_current FROM weeks WHERE id = 1;
