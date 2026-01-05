# Playoff Fantasy Football - Project Specification

## Overview

A web application for ~100 players to compete in a playoff fantasy football game where each NFL player can only be used once across all 4 playoff weeks. The winner is whoever accumulates the most points by the end of the Super Bowl.

---

## Core Concept

- **Player Pool:** All NFL players from teams still alive in the playoffs
- **Key Mechanic:** Once you use a player in your lineup, they're locked and cannot be used again
- **Strategy:** Balance scoring now vs. saving players for later rounds
- **Winner:** Highest cumulative score after Super Bowl

---

## Playoff Structure

| Week | Round | Games | Teams | Roster Size |
|------|-------|-------|-------|-------------|
| 1 | Wild Card | 6 | 12 | 15 |
| 2 | Divisional | 4 | 8 | 15 |
| 3 | Conference Championships | 2 | 4 | 15 |
| 4 | Super Bowl | 1 | 2 | 8 |

---

## Roster Requirements

### Weeks 1-3 (Wild Card, Divisional, Conference)
| Position | Slots |
|----------|-------|
| QB | 2 |
| RB | 3 |
| WR | 4 |
| TE | 2 |
| K | 2 |
| DEF | 2 |
| **Total** | **15** |

**Partial rosters NOT allowed** - all 15 slots must be filled.

### Week 4 (Super Bowl)
| Position | Slots |
|----------|-------|
| QB | 1 |
| RB | 2 |
| WR | 2 |
| TE | 1 |
| K | 1 |
| DEF | 1 |
| **Total** | **8** |

**Partial rosters allowed** - empty slots permitted if no eligible players remain.

---

## Scoring System

### Passing
| Stat | Points |
|------|--------|
| Passing Yards | 1 pt per 25 yards (0.04/yard) |
| Passing TD | 6 pts |
| Interception | -2 pts |
| 2PT Conversion (pass) | 2 pts |

### Rushing
| Stat | Points |
|------|--------|
| Rushing Yards | 1 pt per 10 yards (0.1/yard) |
| Rushing TD | 6 pts |
| 2PT Conversion (rush) | 2 pts |

### Receiving
| Stat | Points |
|------|--------|
| Reception | 0.5 pts (PPR) |
| Receiving Yards | 1 pt per 10 yards (0.1/yard) |
| Receiving TD | 6 pts |
| 2PT Conversion (rec) | 2 pts |

### Turnovers
| Stat | Points |
|------|--------|
| Fumble Lost | -2 pts |

### Special Teams (Individual Players)
| Stat | Points |
|------|--------|
| Punt Return TD | 6 pts |
| Kick Return TD | 6 pts |

### Kicking
| Stat | Points |
|------|--------|
| Field Goal | 0.1 pts per yard (e.g., 37-yd FG = 3.7 pts) |
| Extra Point Made | 1 pt |
| Extra Point Missed | -1 pt |

### Team Defense
| Stat | Points |
|------|--------|
| Fumble Recovery | 2 pts |
| Interception | 2 pts |
| Sack | 1 pt |
| Safety | 2 pts |

### Points Against (Defense)
| Points Allowed | Fantasy Points |
|----------------|----------------|
| 0-6 | 10 pts |
| 7-13 | 7 pts |
| 14-20 | 4 pts |
| 21-27 | 1 pt |
| 28-34 | 0 pts |
| 35-41 | -1 pt |
| 42+ | -3 pts |

---

## User Features

### Account & Entries
- Sign up via public link (no invite code needed)
- Single account can have **multiple entries** (same email)
- Each entry is completely independent
- Switch between entries without logging out
- Each entry has its own:
  - Team name
  - Lineup history
  - Used players list
  - Point total

### Lineup Management
- View all available players (from teams still alive)
- Filter by position
- See players already used (greyed out, non-selectable)
- Submit lineup before deadline
- Edit lineup until lockout
- View submitted lineup after lock

### Dashboard
- View all personal entries and their standings
- See current week's points per entry
- See cumulative points per entry
- Quick links to edit each entry's lineup

### Leaderboard
- All entries ranked by cumulative points
- Columns:
  - Rank
  - Entry Name
  - Owner Name
  - Week 1 Points
  - Week 2 Points
  - Week 3 Points
  - Week 4 Points
  - Total Points
- Sortable by week or total
- Search/filter functionality

### Perfect Roster
- Shows the optimal lineup for each week
- Calculated after games complete
- Displays:
  - Best possible players at each position
  - Individual player scores
  - Total "perfect" score
- Helps users see how close they got to optimal

---

## Admin Features

### God Mode Controls
- **User Management:**
  - View all users and their entries
  - Remove/ban users
  - Manually add new users
  - Reset user passwords

- **Entry Management:**
  - View any entry's lineup (past and current)
  - Edit any entry's lineup (even after lock)
  - Delete entries
  - Create entries on behalf of users

- **League Management:**
  - Set which teams are still alive each week
  - Manually adjust scores if needed
  - Override lockout times
  - Send announcements to all users

- **Player/Scoring:**
  - Manually edit player scores
  - Add/remove players from pool
  - Recalculate all scores

### Dashboard
- Total entries count
- Lineups submitted vs. missing (per week)
- Quick access to users missing lineups
- Activity log

---

## Notifications

All notifications sent via email (and optionally push if we add PWA support).

### Lineup Reminders
1. **24 hours before lock:** "Your lineup for [Week] is incomplete. Lock time: [DateTime]"
2. **60 minutes before lock:** "URGENT: Your lineup locks in 1 hour!"

Only sent if lineup is incomplete. Sent per-entry (user with 3 entries gets up to 3 emails).

### Live Scoring
- **Touchdown alert:** "[Player Name] scored a TD! +6 points for [Entry Name]"
- Sent in real-time when play is recorded

### Weekly Summary
- **Week complete:** "Week [X] is in the books! [Entry Name] scored [X] points. You're now ranked #[X]. View leaderboard →"
- Sent after final game of each week ends

---

## Technical Architecture

### Frontend
- **Framework:** React with TypeScript
- **Styling:** Tailwind CSS
- **State Management:** React Query (for server state)
- **Routing:** React Router
- **PWA:** Optional future enhancement for push notifications

### Backend
- **Platform:** Supabase
  - PostgreSQL database
  - Authentication (email/password)
  - Row Level Security for data protection
  - Realtime subscriptions for live updates
  - Edge Functions for complex logic

### NFL Data
- **Primary Option:** ESPN API (free, unofficial)
- **Backup Option:** SportsData.io ($10-50/mo for playoffs)
- **Data Needed:**
  - Player rosters by team
  - Live game stats
  - Game schedules and status
  - Team elimination status

### Hosting
- **Frontend:** Vercel (free tier)
- **Backend:** Supabase (free tier, upgrade if needed)
- **Estimated Cost:** $0-20/month

---

## Database Schema

### Tables

#### `users`
```sql
id              UUID PRIMARY KEY
email           TEXT UNIQUE NOT NULL
password_hash   TEXT NOT NULL
display_name    TEXT
is_admin        BOOLEAN DEFAULT FALSE
created_at      TIMESTAMP DEFAULT NOW()
```

#### `entries`
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)
entry_name      TEXT NOT NULL
created_at      TIMESTAMP DEFAULT NOW()
is_active       BOOLEAN DEFAULT TRUE
```

#### `teams` (NFL Teams)
```sql
id              TEXT PRIMARY KEY (e.g., 'KC', 'BUF')
name            TEXT NOT NULL (e.g., 'Chiefs', 'Bills')
city            TEXT NOT NULL
is_alive        BOOLEAN DEFAULT TRUE
eliminated_week INTEGER
```

#### `players`
```sql
id              TEXT PRIMARY KEY (external ID from API)
name            TEXT NOT NULL
position        TEXT NOT NULL (QB, RB, WR, TE, K, DEF)
team_id         TEXT REFERENCES teams(id)
is_active       BOOLEAN DEFAULT TRUE
```

#### `weeks`
```sql
id              INTEGER PRIMARY KEY (1-4)
name            TEXT NOT NULL
roster_size     INTEGER NOT NULL
lockout_time    TIMESTAMP NOT NULL
is_current      BOOLEAN DEFAULT FALSE
is_complete     BOOLEAN DEFAULT FALSE
```

#### `roster_requirements`
```sql
week_id         INTEGER REFERENCES weeks(id)
position        TEXT NOT NULL
slots_required  INTEGER NOT NULL
PRIMARY KEY (week_id, position)
```

#### `lineups`
```sql
id              UUID PRIMARY KEY
entry_id        UUID REFERENCES entries(id)
week_id         INTEGER REFERENCES weeks(id)
is_submitted    BOOLEAN DEFAULT FALSE
submitted_at    TIMESTAMP
UNIQUE(entry_id, week_id)
```

#### `lineup_players`
```sql
id              UUID PRIMARY KEY
lineup_id       UUID REFERENCES lineups(id)
player_id       TEXT REFERENCES players(id)
position_slot   TEXT NOT NULL (e.g., 'QB1', 'RB2', 'WR3')
points_scored   DECIMAL(10,2) DEFAULT 0
```

#### `used_players`
```sql
entry_id        UUID REFERENCES entries(id)
player_id       TEXT REFERENCES players(id)
week_used       INTEGER REFERENCES weeks(id)
PRIMARY KEY (entry_id, player_id)
```

#### `player_weekly_stats`
```sql
player_id       TEXT REFERENCES players(id)
week_id         INTEGER REFERENCES weeks(id)
pass_yards      INTEGER DEFAULT 0
pass_td         INTEGER DEFAULT 0
interceptions   INTEGER DEFAULT 0
rush_yards      INTEGER DEFAULT 0
rush_td         INTEGER DEFAULT 0
receptions      INTEGER DEFAULT 0
rec_yards       INTEGER DEFAULT 0
rec_td          INTEGER DEFAULT 0
fumbles_lost    INTEGER DEFAULT 0
two_pt_conv     INTEGER DEFAULT 0
punt_ret_td     INTEGER DEFAULT 0
kick_ret_td     INTEGER DEFAULT 0
fg_made_yards   INTEGER DEFAULT 0  -- sum of all FG yards
xp_made         INTEGER DEFAULT 0
xp_missed       INTEGER DEFAULT 0
def_fumble_rec  INTEGER DEFAULT 0
def_int         INTEGER DEFAULT 0
def_sacks       DECIMAL(4,1) DEFAULT 0
def_safety      INTEGER DEFAULT 0
def_pts_allowed INTEGER DEFAULT 0
total_points    DECIMAL(10,2) DEFAULT 0
PRIMARY KEY (player_id, week_id)
```

#### `notifications`
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)
entry_id        UUID REFERENCES entries(id)
type            TEXT NOT NULL
message         TEXT NOT NULL
sent_at         TIMESTAMP DEFAULT NOW()
read_at         TIMESTAMP
```

---

## Pages & Routes

### Public
- `/` - Landing page with signup/login
- `/signup` - Create account
- `/login` - Sign in

### Authenticated
- `/dashboard` - User's entries overview
- `/entry/:id` - Single entry detail view
- `/entry/:id/lineup` - Set lineup for current week
- `/entry/:id/history` - View past lineups
- `/leaderboard` - Full standings
- `/leaderboard/perfect` - Perfect roster view
- `/players` - Browse all players and stats
- `/rules` - Scoring rules and FAQ
- `/settings` - Account settings, notification preferences

### Admin Only
- `/admin` - Admin dashboard
- `/admin/users` - User management
- `/admin/entries` - All entries management
- `/admin/entry/:id/edit` - Edit any entry's lineup
- `/admin/teams` - Set team alive/eliminated status
- `/admin/scores` - Manual score adjustments
- `/admin/notifications` - Send announcements

---

## Development Phases

### Phase 1: Foundation (Week 1)
- [ ] Set up Supabase project
- [ ] Create database schema
- [ ] Implement authentication
- [ ] Build basic UI layout
- [ ] Create user signup flow
- [ ] Build entry creation (multiple per user)

### Phase 2: Core Gameplay (Week 2)
- [ ] NFL player data import
- [ ] Lineup selection UI
- [ ] Used player tracking
- [ ] Lineup validation (correct positions, no reused players)
- [ ] Lineup submission with lockout

### Phase 3: Scoring & Standings (Week 3)
- [ ] NFL stats API integration
- [ ] Score calculation engine
- [ ] Leaderboard
- [ ] Perfect roster calculator
- [ ] User dashboard

### Phase 4: Admin & Polish (Week 4)
- [ ] Admin dashboard
- [ ] God mode controls
- [ ] Manual overrides
- [ ] Team elimination management

### Phase 5: Notifications (Week 5)
- [ ] Email service setup (Resend or SendGrid)
- [ ] Lineup reminder system
- [ ] Live touchdown alerts
- [ ] Weekly summary emails

### Phase 6: Testing & Launch
- [ ] End-to-end testing
- [ ] Load testing for 100 users
- [ ] Bug fixes
- [ ] Deploy to production
- [ ] Share signup link!

---

## NFL Data API Options

### Option 1: ESPN API (Recommended for MVP)
- **Cost:** Free (unofficial)
- **Pros:** Free, comprehensive data
- **Cons:** Unofficial, could break, rate limits
- **Endpoints:**
  - Scoreboard: `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`
  - Teams: `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams`
  - Player stats require parsing box scores

### Option 2: SportsData.io
- **Cost:** $10-50/month
- **Pros:** Official, reliable, real-time
- **Cons:** Costs money
- **Has everything we need out of the box**

### Option 3: The Odds API + ESPN Combo
- **Cost:** Free tier available
- **Use for game status, ESPN for stats**

### Recommendation
Start with ESPN API for development. If it proves unreliable during playoffs, upgrade to SportsData.io (~$25 for playoff period).

---

## Estimated Costs

| Service | Free Tier | If Upgraded |
|---------|-----------|-------------|
| Supabase | 500MB DB, 50K auth users | $25/mo |
| Vercel | 100GB bandwidth | $20/mo |
| NFL Data | ESPN free | $25/mo |
| Email (Resend) | 3K emails/mo | $20/mo |
| **Total** | **$0** | **~$90/mo max** |

For 100 users during a 4-week playoff period, **free tier should work fine**.

---

## Entry Fee & Payouts

### Entry Fee
- **$25 per entry**
- Payment handled externally (Venmo, cash, etc.)
- No in-app payment processing

### Entry Limits
- **No cap** on entries per user
- Users can create/remove entries **until kickoff of Wild Card Weekend**
- After first kickoff: entries are locked (no add/remove)

### Payout Structure
Payout spots scale with total entries:

| Total Entries | Paid Positions |
|---------------|----------------|
| 1-49 | Top 4 |
| 50-59 | Top 5 |
| 60-69 | Top 6 |
| 70-79 | Top 7 |
| 80-89 | Top 8 |
| 90-99 | Top 9 |
| 100+ | Top 10 |

*(Adjust payout amounts as you see fit—this just tracks how many spots pay)*

### Leaderboard "In the Money" Display
- Leaderboard shows a visual indicator (highlight, badge, or line) for entries currently in payout positions
- As entries are added, the "money line" adjusts automatically
- Example: With 65 entries, positions 1-6 are highlighted as "In the Money"

### Tiebreaker
- **Primary:** Most points scored during Super Bowl week
- If still tied after tiebreaker: co-champions split the position

---

## Entry Management Rules

### Before Wild Card Kickoff
- Users can create unlimited entries
- Users can delete their own entries
- Users can edit entry names

### After Wild Card Kickoff
- No new entries allowed
- No entry deletion allowed
- Lineup editing still allowed (until each week's lockout)

### Admin Override
- Admin can add/remove entries at any time regardless of lockout

---

## Admin Features (Updated)

### User & Entry Overview
- View all users
- See entry count per user
- See payment status (manual tracking field)
- Quick view: users who haven't paid yet

### Entry Management
- Total entry count (prominent display)
- Current payout spots based on entry count
- List of entries with:
  - Entry name
  - Owner name/email
  - Created date
  - Payment received (checkbox for admin to mark)

---

## Timeline

**🚨 LAUNCH TARGET: Wednesday (3 days)**

### Day 1 (Today): Foundation
- [ ] Set up Supabase + Vercel
- [ ] Database schema
- [ ] Authentication (signup/login)
- [ ] Entry creation (multiple per user)
- [ ] Basic UI shell

### Day 2: Core Features
- [ ] Player data import
- [ ] Lineup selection UI
- [ ] Used player tracking
- [ ] Lineup validation
- [ ] Leaderboard with "in the money" indicator
- [ ] Entry deletion (pre-lockout)

### Day 3: Admin & Polish
- [ ] Admin dashboard
- [ ] User/entry management
- [ ] Payment tracking
- [ ] Entry lockout logic
- [ ] Testing & bug fixes
- [ ] Deploy to production

### Post-Launch (before games start)
- [ ] NFL stats API integration
- [ ] Live scoring
- [ ] Notifications (can be added after launch if needed)

---

## MVP vs. Nice-to-Have

### MVP (Must have for Wednesday)
✅ User signup/login
✅ Multiple entries per user
✅ Entry deletion before lockout
✅ Lineup selection with position requirements
✅ Used player tracking
✅ Leaderboard with money line
✅ Admin: view users, entries, mark payments
✅ Admin: edit any lineup

### Nice-to-Have (Add after launch)
⏳ Live scoring (can do manual score entry for Week 1 if needed)
⏳ Push notifications
⏳ Perfect roster calculator
⏳ Email reminders

---

## Next Steps

1. **Right now:** Create accounts
   - [Supabase](https://supabase.com) — click "Start your project"
   - [Vercel](https://vercel.com) — sign up with GitHub

2. **Install Claude Code** (if not done):
   ```bash
   curl -fsSL https://claude.ai/install.sh | bash
   ```

3. **Create project folder:**
   ```bash
   mkdir playoff-fantasy
   cd playoff-fantasy
   ```

4. **Start Claude Code:**
   ```bash
   claude
   ```

5. **Initialize the project** — tell Claude Code:
   > "I'm building a playoff fantasy football web app. Read playoff-fantasy-spec.md and help me set up a React + Supabase project. Start with authentication and entry creation."

---

## Open Questions

1. **Payout amounts?** Do you want the app to display actual dollar amounts, or just "1st place, 2nd place, etc."?
2. **Domain name?** Do you have one, or use the free Vercel URL (something like `playoff-fantasy.vercel.app`)?
3. **Your Supabase/Vercel accounts ready?** Let me know when they're set up and I can help with the next steps.

---

*Document Version: 1.0*
*Last Updated: January 2025*
