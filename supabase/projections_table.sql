-- Projections cache table
-- Stores daily fantasy point projections from SportsDataIO

CREATE TABLE IF NOT EXISTS projections (
  id SERIAL PRIMARY KEY,
  player_name TEXT NOT NULL,
  team_id TEXT NOT NULL,
  week_id INTEGER NOT NULL,
  fantasy_points DECIMAL(6,2) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_name, team_id, week_id)
);

-- Index for fast lookups by week
CREATE INDEX IF NOT EXISTS idx_projections_week ON projections(week_id);

-- Index for player lookups
CREATE INDEX IF NOT EXISTS idx_projections_player ON projections(player_name, team_id);

-- RLS policies (public read, no direct writes from client)
ALTER TABLE projections ENABLE ROW LEVEL SECURITY;

-- Anyone can read projections
CREATE POLICY "Projections are viewable by everyone"
  ON projections FOR SELECT
  USING (true);
