-- Playoff Gauntlet Database Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- PROFILES TABLE (extends Supabase auth.users)
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NFL TEAMS
-- ============================================
CREATE TABLE teams (
  id TEXT PRIMARY KEY, -- e.g., 'KC', 'BUF'
  name TEXT NOT NULL, -- e.g., 'Chiefs', 'Bills'
  city TEXT NOT NULL,
  conference TEXT NOT NULL, -- 'AFC' or 'NFC'
  is_alive BOOLEAN DEFAULT TRUE,
  eliminated_week INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WEEKS
-- ============================================
CREATE TABLE weeks (
  id INTEGER PRIMARY KEY, -- 1-4
  name TEXT NOT NULL, -- 'Wild Card', 'Divisional', etc.
  roster_size INTEGER NOT NULL,
  lockout_time TIMESTAMPTZ NOT NULL,
  is_current BOOLEAN DEFAULT FALSE,
  is_complete BOOLEAN DEFAULT FALSE
);

-- ============================================
-- ROSTER REQUIREMENTS PER WEEK
-- ============================================
CREATE TABLE roster_requirements (
  week_id INTEGER REFERENCES weeks(id) ON DELETE CASCADE,
  position TEXT NOT NULL, -- QB, RB, WR, TE, K, DEF
  slots_required INTEGER NOT NULL,
  PRIMARY KEY (week_id, position)
);

-- ============================================
-- NFL PLAYERS
-- ============================================
CREATE TABLE players (
  id TEXT PRIMARY KEY, -- external ID from API
  name TEXT NOT NULL,
  position TEXT NOT NULL, -- QB, RB, WR, TE, K, DEF
  team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  headshot_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USER ENTRIES
-- ============================================
CREATE TABLE entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entry_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  payment_received BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LINEUPS (one per entry per week)
-- ============================================
CREATE TABLE lineups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  week_id INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  is_submitted BOOLEAN DEFAULT FALSE,
  submitted_at TIMESTAMPTZ,
  total_points DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_id, week_id)
);

-- ============================================
-- LINEUP PLAYERS (players in each lineup)
-- ============================================
CREATE TABLE lineup_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lineup_id UUID NOT NULL REFERENCES lineups(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  position_slot TEXT NOT NULL, -- e.g., 'QB1', 'RB2', 'WR3'
  points_scored DECIMAL(10,2) DEFAULT 0,
  UNIQUE(lineup_id, position_slot),
  UNIQUE(lineup_id, player_id)
);

-- ============================================
-- USED PLAYERS (tracks which players an entry has used)
-- ============================================
CREATE TABLE used_players (
  entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  week_used INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, player_id)
);

-- ============================================
-- PLAYER WEEKLY STATS
-- ============================================
CREATE TABLE player_weekly_stats (
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  week_id INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  -- Passing
  pass_yards INTEGER DEFAULT 0,
  pass_td INTEGER DEFAULT 0,
  interceptions INTEGER DEFAULT 0,
  -- Rushing
  rush_yards INTEGER DEFAULT 0,
  rush_td INTEGER DEFAULT 0,
  -- Receiving
  receptions INTEGER DEFAULT 0,
  rec_yards INTEGER DEFAULT 0,
  rec_td INTEGER DEFAULT 0,
  -- Misc
  fumbles_lost INTEGER DEFAULT 0,
  two_pt_conv INTEGER DEFAULT 0,
  -- Special Teams
  punt_ret_td INTEGER DEFAULT 0,
  kick_ret_td INTEGER DEFAULT 0,
  -- Kicking
  fg_made_yards INTEGER DEFAULT 0, -- sum of all FG yards
  xp_made INTEGER DEFAULT 0,
  xp_missed INTEGER DEFAULT 0,
  -- Defense
  def_fumble_rec INTEGER DEFAULT 0,
  def_int INTEGER DEFAULT 0,
  def_sacks DECIMAL(4,1) DEFAULT 0,
  def_safety INTEGER DEFAULT 0,
  def_pts_allowed INTEGER DEFAULT 0,
  -- Calculated
  total_points DECIMAL(10,2) DEFAULT 0,
  PRIMARY KEY (player_id, week_id)
);

-- ============================================
-- LEAGUE SETTINGS
-- ============================================
CREATE TABLE league_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- singleton
  entries_locked BOOLEAN DEFAULT FALSE,
  entry_fee DECIMAL(10,2) DEFAULT 25.00,
  current_week_id INTEGER REFERENCES weeks(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_entries_user_id ON entries(user_id);
CREATE INDEX idx_lineups_entry_id ON lineups(entry_id);
CREATE INDEX idx_lineups_week_id ON lineups(week_id);
CREATE INDEX idx_lineup_players_lineup_id ON lineup_players(lineup_id);
CREATE INDEX idx_lineup_players_player_id ON lineup_players(player_id);
CREATE INDEX idx_used_players_entry_id ON used_players(entry_id);
CREATE INDEX idx_players_team_id ON players(team_id);
CREATE INDEX idx_players_position ON players(position);
CREATE INDEX idx_player_weekly_stats_week_id ON player_weekly_stats(week_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to calculate fantasy points from stats
CREATE OR REPLACE FUNCTION calculate_fantasy_points(
  p_pass_yards INTEGER,
  p_pass_td INTEGER,
  p_interceptions INTEGER,
  p_rush_yards INTEGER,
  p_rush_td INTEGER,
  p_receptions INTEGER,
  p_rec_yards INTEGER,
  p_rec_td INTEGER,
  p_fumbles_lost INTEGER,
  p_two_pt_conv INTEGER,
  p_punt_ret_td INTEGER,
  p_kick_ret_td INTEGER,
  p_fg_made_yards INTEGER,
  p_xp_made INTEGER,
  p_xp_missed INTEGER,
  p_def_fumble_rec INTEGER,
  p_def_int INTEGER,
  p_def_sacks DECIMAL,
  p_def_safety INTEGER,
  p_def_pts_allowed INTEGER
) RETURNS DECIMAL AS $$
DECLARE
  points DECIMAL := 0;
  def_pts_bonus DECIMAL := 0;
BEGIN
  -- Passing: 0.04 per yard, 6 per TD, -2 per INT
  points := points + (p_pass_yards * 0.04);
  points := points + (p_pass_td * 6);
  points := points + (p_interceptions * -2);

  -- Rushing: 0.1 per yard, 6 per TD
  points := points + (p_rush_yards * 0.1);
  points := points + (p_rush_td * 6);

  -- Receiving: 0.5 per reception (PPR), 0.1 per yard, 6 per TD
  points := points + (p_receptions * 0.5);
  points := points + (p_rec_yards * 0.1);
  points := points + (p_rec_td * 6);

  -- Turnovers
  points := points + (p_fumbles_lost * -2);

  -- 2PT conversions
  points := points + (p_two_pt_conv * 2);

  -- Special teams TDs
  points := points + (p_punt_ret_td * 6);
  points := points + (p_kick_ret_td * 6);

  -- Kicking: 0.1 per FG yard, 1 per XP made, -1 per XP missed
  points := points + (p_fg_made_yards * 0.1);
  points := points + (p_xp_made * 1);
  points := points + (p_xp_missed * -1);

  -- Defense
  points := points + (p_def_fumble_rec * 2);
  points := points + (p_def_int * 2);
  points := points + (p_def_sacks * 1);
  points := points + (p_def_safety * 2);

  -- Points allowed bonus
  IF p_def_pts_allowed <= 6 THEN def_pts_bonus := 10;
  ELSIF p_def_pts_allowed <= 13 THEN def_pts_bonus := 7;
  ELSIF p_def_pts_allowed <= 20 THEN def_pts_bonus := 4;
  ELSIF p_def_pts_allowed <= 27 THEN def_pts_bonus := 1;
  ELSIF p_def_pts_allowed <= 34 THEN def_pts_bonus := 0;
  ELSIF p_def_pts_allowed <= 41 THEN def_pts_bonus := -1;
  ELSE def_pts_bonus := -3;
  END IF;

  -- Only add defense points bonus if there are defensive stats
  IF p_def_fumble_rec > 0 OR p_def_int > 0 OR p_def_sacks > 0 OR p_def_safety > 0 OR p_def_pts_allowed IS NOT NULL THEN
    points := points + def_pts_bonus;
  END IF;

  RETURN ROUND(points, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to get entry's total points
CREATE OR REPLACE FUNCTION get_entry_total_points(p_entry_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  total DECIMAL;
BEGIN
  SELECT COALESCE(SUM(total_points), 0) INTO total
  FROM lineups
  WHERE entry_id = p_entry_id;
  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- Function to get payout positions based on entry count
CREATE OR REPLACE FUNCTION get_payout_positions()
RETURNS INTEGER AS $$
DECLARE
  entry_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO entry_count FROM entries WHERE is_active = TRUE;

  IF entry_count >= 100 THEN RETURN 10;
  ELSIF entry_count >= 90 THEN RETURN 9;
  ELSIF entry_count >= 80 THEN RETURN 8;
  ELSIF entry_count >= 70 THEN RETURN 7;
  ELSIF entry_count >= 60 THEN RETURN 6;
  ELSIF entry_count >= 50 THEN RETURN 5;
  ELSE RETURN 4;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineup_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE used_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_weekly_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_settings ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Entries policies
CREATE POLICY "Users can view all entries" ON entries
  FOR SELECT USING (true);

CREATE POLICY "Users can create own entries" ON entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entries" ON entries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own entries" ON entries
  FOR DELETE USING (auth.uid() = user_id);

-- Lineups policies
CREATE POLICY "Users can view all lineups" ON lineups
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own lineups" ON lineups
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM entries
      WHERE entries.id = lineups.entry_id
      AND entries.user_id = auth.uid()
    )
  );

-- Lineup players policies
CREATE POLICY "Users can view all lineup players" ON lineup_players
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own lineup players" ON lineup_players
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM lineups
      JOIN entries ON entries.id = lineups.entry_id
      WHERE lineups.id = lineup_players.lineup_id
      AND entries.user_id = auth.uid()
    )
  );

-- Used players policies
CREATE POLICY "Users can view own used players" ON used_players
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM entries
      WHERE entries.id = used_players.entry_id
      AND entries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own used players" ON used_players
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM entries
      WHERE entries.id = used_players.entry_id
      AND entries.user_id = auth.uid()
    )
  );

-- Public read access for reference tables
CREATE POLICY "Anyone can view teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Anyone can view players" ON players FOR SELECT USING (true);
CREATE POLICY "Anyone can view weeks" ON weeks FOR SELECT USING (true);
CREATE POLICY "Anyone can view roster requirements" ON roster_requirements FOR SELECT USING (true);
CREATE POLICY "Anyone can view player stats" ON player_weekly_stats FOR SELECT USING (true);
CREATE POLICY "Anyone can view league settings" ON league_settings FOR SELECT USING (true);

-- Admin policies (for admin users)
CREATE POLICY "Admins can do anything on profiles" ON profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can do anything on entries" ON entries
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can do anything on teams" ON teams
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can do anything on players" ON players
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can do anything on weeks" ON weeks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can do anything on roster_requirements" ON roster_requirements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can do anything on player_weekly_stats" ON player_weekly_stats
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can do anything on league_settings" ON league_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can do anything on lineups" ON lineups
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can do anything on lineup_players" ON lineup_players
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can do anything on used_players" ON used_players
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );
