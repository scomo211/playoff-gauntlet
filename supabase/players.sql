-- NFL Playoff Players 2024-2025 Season
-- Run this AFTER schema.sql and seed.sql

-- ============================================
-- KANSAS CITY CHIEFS (KC)
-- ============================================
INSERT INTO players (id, name, position, team_id) VALUES
('kc-mahomes', 'Patrick Mahomes', 'QB', 'KC'),
('kc-worthy', 'Xavier Worthy', 'WR', 'KC'),
('kc-rice', 'Rashee Rice', 'WR', 'KC'),
('kc-watson', 'Justin Watson', 'WR', 'KC'),
('kc-kelce', 'Travis Kelce', 'TE', 'KC'),
('kc-edwards-helaire', 'Clyde Edwards-Helaire', 'RB', 'KC'),
('kc-pacheco', 'Isiah Pacheco', 'RB', 'KC'),
('kc-hunt', 'Kareem Hunt', 'RB', 'KC'),
('kc-butker', 'Harrison Butker', 'K', 'KC'),
('kc-def', 'Chiefs Defense', 'DEF', 'KC');

-- ============================================
-- BUFFALO BILLS (BUF)
-- ============================================
INSERT INTO players (id, name, position, team_id) VALUES
('buf-allen', 'Josh Allen', 'QB', 'BUF'),
('buf-cook', 'James Cook', 'RB', 'BUF'),
('buf-murray', 'Ty Murray', 'RB', 'BUF'),
('buf-kincaid', 'Dalton Kincaid', 'TE', 'BUF'),
('buf-knox', 'Dawson Knox', 'TE', 'BUF'),
('buf-coleman', 'Keon Coleman', 'WR', 'BUF'),
('buf-samuel', 'Curtis Samuel', 'WR', 'BUF'),
('buf-shakir', 'Khalil Shakir', 'WR', 'BUF'),
('buf-hollins', 'Mack Hollins', 'WR', 'BUF'),
('buf-bass', 'Tyler Bass', 'K', 'BUF'),
('buf-def', 'Bills Defense', 'DEF', 'BUF');

-- ============================================
-- BALTIMORE RAVENS (BAL)
-- ============================================
INSERT INTO players (id, name, position, team_id) VALUES
('bal-jackson', 'Lamar Jackson', 'QB', 'BAL'),
('bal-henry', 'Derrick Henry', 'RB', 'BAL'),
('bal-hill', 'Justice Hill', 'RB', 'BAL'),
('bal-flowers', 'Zay Flowers', 'WR', 'BAL'),
('bal-bateman', 'Rashod Bateman', 'WR', 'BAL'),
('bal-agholor', 'Nelson Agholor', 'WR', 'BAL'),
('bal-likely', 'Isaiah Likely', 'TE', 'BAL'),
('bal-andrews', 'Mark Andrews', 'TE', 'BAL'),
('bal-tucker', 'Justin Tucker', 'K', 'BAL'),
('bal-def', 'Ravens Defense', 'DEF', 'BAL');

-- ============================================
-- HOUSTON TEXANS (HOU)
-- ============================================
INSERT INTO players (id, name, position, team_id) VALUES
('hou-stroud', 'C.J. Stroud', 'QB', 'HOU'),
('hou-mixon', 'Joe Mixon', 'RB', 'HOU'),
('hou-blue', 'Dameon Pierce', 'RB', 'HOU'),
('hou-collins', 'Nico Collins', 'WR', 'HOU'),
('hou-dell', 'Tank Dell', 'WR', 'HOU'),
('hou-diggs', 'Stefon Diggs', 'WR', 'HOU'),
('hou-schultz', 'Dalton Schultz', 'TE', 'HOU'),
('hou-fairbairn', 'Ka''imi Fairbairn', 'K', 'HOU'),
('hou-def', 'Texans Defense', 'DEF', 'HOU');

-- ============================================
-- LOS ANGELES CHARGERS (LAC)
-- ============================================
INSERT INTO players (id, name, position, team_id) VALUES
('lac-herbert', 'Justin Herbert', 'QB', 'LAC'),
('lac-dobbins', 'J.K. Dobbins', 'RB', 'LAC'),
('lac-davis', 'Gus Edwards', 'RB', 'LAC'),
('lac-mcconkey', 'Ladd McConkey', 'WR', 'LAC'),
('lac-johnston', 'Quentin Johnston', 'WR', 'LAC'),
('lac-palmer', 'Joshua Palmer', 'WR', 'LAC'),
('lac-everett', 'Will Dissly', 'TE', 'LAC'),
('lac-parham', 'Donald Parham', 'TE', 'LAC'),
('lac-dicker', 'Cameron Dicker', 'K', 'LAC'),
('lac-def', 'Chargers Defense', 'DEF', 'LAC');

-- ============================================
-- PITTSBURGH STEELERS (PIT)
-- ============================================
INSERT INTO players (id, name, position, team_id) VALUES
('pit-wilson', 'Russell Wilson', 'QB', 'PIT'),
('pit-fields', 'Justin Fields', 'QB', 'PIT'),
('pit-harris', 'Najee Harris', 'RB', 'PIT'),
('pit-warren', 'Jaylen Warren', 'RB', 'PIT'),
('pit-pickens', 'George Pickens', 'WR', 'PIT'),
('pit-austin', 'Calvin Austin III', 'WR', 'PIT'),
('pit-jefferson', 'Van Jefferson', 'WR', 'PIT'),
('pit-freiermuth', 'Pat Freiermuth', 'TE', 'PIT'),
('pit-boswell', 'Chris Boswell', 'K', 'PIT'),
('pit-def', 'Steelers Defense', 'DEF', 'PIT');

-- ============================================
-- DENVER BRONCOS (DEN)
-- ============================================
INSERT INTO players (id, name, position, team_id) VALUES
('den-nix', 'Bo Nix', 'QB', 'DEN'),
('den-williams', 'Javonte Williams', 'RB', 'DEN'),
('den-penny', 'Jaleel McLaughlin', 'RB', 'DEN'),
('den-sutton', 'Courtland Sutton', 'WR', 'DEN'),
('den-jeudy', 'Marvin Mims Jr.', 'WR', 'DEN'),
('den-franklin', 'Troy Franklin', 'WR', 'DEN'),
('den-tomlinson', 'Adam Trautman', 'TE', 'DEN'),
('den-lutz', 'Wil Lutz', 'K', 'DEN'),
('den-def', 'Broncos Defense', 'DEF', 'DEN');

-- ============================================
-- DETROIT LIONS (DET)
-- ============================================
INSERT INTO players (id, name, position, team_id) VALUES
('det-goff', 'Jared Goff', 'QB', 'DET'),
('det-gibbs', 'Jahmyr Gibbs', 'RB', 'DET'),
('det-montgomery', 'David Montgomery', 'RB', 'DET'),
('det-williams', 'Jameson Williams', 'WR', 'DET'),
('det-st-brown', 'Amon-Ra St. Brown', 'WR', 'DET'),
('det-reynolds', 'Tim Patrick', 'WR', 'DET'),
('det-laporta', 'Sam LaPorta', 'TE', 'DET'),
('det-badgley', 'Jake Bates', 'K', 'DET'),
('det-def', 'Lions Defense', 'DEF', 'DET');

-- ============================================
-- PHILADELPHIA EAGLES (PHI)
-- ============================================
INSERT INTO players (id, name, position, team_id) VALUES
('phi-hurts', 'Jalen Hurts', 'QB', 'PHI'),
('phi-barkley', 'Saquon Barkley', 'RB', 'PHI'),
('phi-gainwell', 'Kenneth Gainwell', 'RB', 'PHI'),
('phi-brown', 'A.J. Brown', 'WR', 'PHI'),
('phi-smith', 'DeVonta Smith', 'WR', 'PHI'),
('phi-wilson', 'Jahan Dotson', 'WR', 'PHI'),
('phi-goedert', 'Dallas Goedert', 'TE', 'PHI'),
('phi-elliott', 'Jake Elliott', 'K', 'PHI'),
('phi-def', 'Eagles Defense', 'DEF', 'PHI');

-- ============================================
-- TAMPA BAY BUCCANEERS (TB)
-- ============================================
INSERT INTO players (id, name, position, team_id) VALUES
('tb-mayfield', 'Baker Mayfield', 'QB', 'TB'),
('tb-white', 'Rachaad White', 'RB', 'TB'),
('tb-irving', 'Bucky Irving', 'RB', 'TB'),
('tb-evans', 'Mike Evans', 'WR', 'TB'),
('tb-godwin', 'Chris Godwin', 'WR', 'TB'),
('tb-mcmillan', 'Jalen McMillan', 'WR', 'TB'),
('tb-otton', 'Cade Otton', 'TE', 'TB'),
('tb-camarda', 'Chase McLaughlin', 'K', 'TB'),
('tb-def', 'Buccaneers Defense', 'DEF', 'TB');

-- ============================================
-- LOS ANGELES RAMS (LAR)
-- ============================================
INSERT INTO players (id, name, position, team_id) VALUES
('lar-stafford', 'Matthew Stafford', 'QB', 'LAR'),
('lar-kyren', 'Kyren Williams', 'RB', 'LAR'),
('lar-akers', 'Blake Corum', 'RB', 'LAR'),
('lar-kupp', 'Cooper Kupp', 'WR', 'LAR'),
('lar-nacua', 'Puka Nacua', 'WR', 'LAR'),
('lar-robinson', 'Demarcus Robinson', 'WR', 'LAR'),
('lar-higbee', 'Tyler Higbee', 'TE', 'LAR'),
('lar-harris', 'Colby Parkinson', 'TE', 'LAR'),
('lar-gay', 'Joshua Karty', 'K', 'LAR'),
('lar-def', 'Rams Defense', 'DEF', 'LAR');

-- ============================================
-- MINNESOTA VIKINGS (MIN)
-- ============================================
INSERT INTO players (id, name, position, team_id) VALUES
('min-darnold', 'Sam Darnold', 'QB', 'MIN'),
('min-mattison', 'Aaron Jones', 'RB', 'MIN'),
('min-chandler', 'Ty Chandler', 'RB', 'MIN'),
('min-jefferson', 'Justin Jefferson', 'WR', 'MIN'),
('min-addison', 'Jordan Addison', 'WR', 'MIN'),
('min-hockenson', 'T.J. Hockenson', 'TE', 'MIN'),
('min-munoz', 'Josh Oliver', 'TE', 'MIN'),
('min-joseph', 'Will Reichard', 'K', 'MIN'),
('min-def', 'Vikings Defense', 'DEF', 'MIN');

-- ============================================
-- WASHINGTON COMMANDERS (WAS)
-- ============================================
INSERT INTO players (id, name, position, team_id) VALUES
('was-daniels', 'Jayden Daniels', 'QB', 'WAS'),
('was-robinson', 'Brian Robinson Jr.', 'RB', 'WAS'),
('was-ekeler', 'Austin Ekeler', 'RB', 'WAS'),
('was-mclaurin', 'Terry McLaurin', 'WR', 'WAS'),
('was-brown', 'Dyami Brown', 'WR', 'WAS'),
('was-ertz', 'Zach Ertz', 'TE', 'WAS'),
('was-rodriguez', 'John Bates', 'TE', 'WAS'),
('was-slye', 'Zane Gonzalez', 'K', 'WAS'),
('was-def', 'Commanders Defense', 'DEF', 'WAS');

-- ============================================
-- GREEN BAY PACKERS (GB)
-- ============================================
INSERT INTO players (id, name, position, team_id) VALUES
('gb-love', 'Jordan Love', 'QB', 'GB'),
('gb-jacobs', 'Josh Jacobs', 'RB', 'GB'),
('gb-williams', 'MarShawn Lloyd', 'RB', 'GB'),
('gb-reed', 'Jayden Reed', 'WR', 'GB'),
('gb-watson', 'Christian Watson', 'WR', 'GB'),
('gb-doubs', 'Romeo Doubs', 'WR', 'GB'),
('gb-wicks', 'Dontayvion Wicks', 'WR', 'GB'),
('gb-kraft', 'Tucker Kraft', 'TE', 'GB'),
('gb-musgrave', 'Luke Musgrave', 'TE', 'GB'),
('gb-crosby', 'Brandon McManus', 'K', 'GB'),
('gb-def', 'Packers Defense', 'DEF', 'GB');
