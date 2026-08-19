# Playoff Gauntlet - Design Brief

## App Overview

**Playoff Gauntlet** is a fantasy football app with two distinct game modes:

1. **Playoff Gauntlet (Main Game)** - A pick'em style contest where users pay $25/entry to build a lineup of NFL playoff players across 4 weeks (Wild Card → Super Bowl). Top finishers split the prize pool.

2. **Salary Cap League** - A dynasty-style keeper league where 12 owners manage $400 salary caps, make offseason decisions (cuts, franchise tags, free agent signings), and participate in a live auction draft.

**Tech Stack:** React 18 + Vite + TypeScript + Tailwind CSS + Supabase

---

## Pages to Redesign

### 1. Dashboard (`/dashboard`)

**Purpose:** Main hub showing league standings and user's personal entries

**Current Elements:**
- Top banner: 3 stat cards (total entries, prize pool, payout positions)
- Rank progression chart (visual line chart)
- Main leaderboard table (2/3 width): Rank, Entry Name, Owner, Week scores, Total Points
  - 20 entries per page with pagination
  - Gold highlighting for payout positions
  - Movement indicators (↑↓)
  - Live update indicator, countdown timer
- "Your Entries" sidebar (1/3 width): Card stack showing user's entries with week status grid
- Favorites leaderboard section
- Weekly stats breakdown

**Problems to Solve:**
- Information density is high - hard to scan quickly
- Week status grid is small and hard to understand at a glance
- Movement indicators lack visual impact
- Mobile layout is cramped
- No celebration/gamification when user is in payout position

---

### 2. Entries (`/entries`)

**Purpose:** Personal entries management with lineup status

**Current Elements:**
- Entry cards showing: name, rank badge, total points, week status grid (4 weeks)
- "Set Lineup" and delete buttons
- "New Entry" button in header

**Problems to Solve:**
- Cards look similar to dashboard - redundant feeling
- Week status grid icons are too small
- No visual distinction between entries in good vs bad positions
- Delete button placement is awkward

---

### 3. Lineup (`/entry/:id/lineup`)

**Purpose:** Select and manage players for a specific entry and week

**Current Elements:**
- Header: Entry name, status badges, total points, week rank
- Week tabs (Wild Card, Divisional, Championship, Super Bowl)
- Lineup grid table: Position, Player (with headshot), Stats, Points, Actions
- Position badges color-coded (QB=red, RB=blue, WR=green, TE=yellow, K=purple, DEF=gray)
- Game status badges (LIVE, FINAL, BYE)
- Player select modal with search and filters
- "Previously Used Players" section
- Submit button with slot counter

**Problems to Solve:**
- Table layout doesn't feel like a "lineup card" - more like a spreadsheet
- Stats are dense text, hard to parse quickly
- Live game excitement isn't conveyed visually
- Player photos are small circles - doesn't feel premium
- Position selection flow requires too many clicks

---

### 4. Players (`/players`)

**Purpose:** Browse all eligible playoff players and view stats

**Current Elements:**
- Playoff bracket visual (interactive, click team for depth chart)
- Filter bar: Search, position dropdown, team dropdown
- Players table: Player name/photo, Position, Week scores, Total
- Depth chart modal per team

**Problems to Solve:**
- Bracket and table feel disconnected
- Hard to find "best available" players quickly
- No visual indication of player value/tier
- Depth chart modal is basic

---

### 5. Salary Cap Dashboard (`/salarycap`)

**Purpose:** League overview for the 12-team salary cap league

**Current Elements:**
- Teams standings list with:
  - Rank, owner name
  - Cap visualization bar (committed vs available)
  - Roster count (X/24)
- Franchise tag costs reference grid

**Problems to Solve:**
- Doesn't feel like a "league home" - very sparse
- No team logos or visual identity for each owner
- Cap bar is hard to compare across teams
- Missing key info at a glance (who's over cap, who has most space)

---

### 6. Team Detail (`/salarycap/team/:ownerId`)

**Purpose:** View a team's roster, contracts, and offseason decisions

**Current Elements:**
- Progress checklist panel (contract decisions, franchise tag, FA pickups, draft availability)
- Cap donut chart (available, salaries, dead cap, bonus cap segments)
- Draft availability calendar (Aug 18-24 time slot grid)
- Under Contract section: Table with Keep/Cut buttons
- Franchise Tag Eligible section: Radio button selection
- Free Agent Pickups section: Sign/Release buttons
- Dead Cap section (read-only)
- Bonus Cap trades section

**Problems to Solve:**
- Too many sections with different colored borders - visual noise
- Tables are repetitive and boring
- Donut chart is small and hard to read
- Calendar grid doesn't look like a calendar
- Decision buttons (Keep/Cut, Sign/Release) are generic
- No visual feedback on decision impact (e.g., "Cutting this player frees $X")

---

### 7. Free Agents (`/salarycap/free-agents`)

**Purpose:** Browse available players for auction draft

**Current Elements:**
- Filter bar: Search, team dropdown, position buttons
- Simple table: Rank, Position, Player (with photo)
- Rookie badges

**Problems to Solve:**
- No player value/projection data
- Can't see recent auction prices or market value
- No way to "watchlist" players
- Very plain design

---

### 8. Offseason (`/salarycap/offseason`)

**Purpose:** Make offseason decisions for your own team

**Current Elements:**
- Same as Team Detail but with full edit capability
- Checklist, cap chart, calendar, contract tables

**Problems to Solve:**
- Same issues as Team Detail
- "Submit Decisions" flow doesn't feel like a milestone
- No summary of "what changed" before submitting

---

### 9. Auction Room (`/salarycap/auction`)

**Purpose:** Live real-time auction draft for 12 owners

**Current Layout (3 columns):**

**Left (Available Players):**
- Search box, position filters
- Scrollable player list with avatars
- "Your turn to nominate" notice

**Center (Active Auction):**
- Current player card (large avatar, name, position)
- Current bid amount (big number)
- Countdown timer (color-coded urgency)
- High bidder name
- Bid controls: "+$1" button, custom bid input
- Recent sales log (last 20)

**Right (Rosters):**
- My roster: players + cap remaining
- All owners list (collapsible): owner name, cap, slots filled

**Problems to Solve:**
- Timer doesn't feel urgent enough (no sound, minimal animation)
- Bidding controls are cramped
- Hard to see who's bidding against you in real-time
- Recent sales log scrolls away too fast
- Player card doesn't show enough info (no stats, no projected value)
- Owner list is just text - no visual identity
- No "bid war" excitement visualization
- Nomination modal is basic

---

## Design Goals

1. **Premium Sports Feel** - Should feel like ESPN/NFL app quality, not a spreadsheet
2. **Scannable Information** - Key data visible at a glance without reading
3. **Gamification** - Celebrate wins, show progress, make it exciting
4. **Real-time Energy** - Live games and auctions should feel alive
5. **Mobile-First** - Must work great on phones (most users check during games)
6. **Dark Theme** - Keep the dark slate aesthetic but make it more polished
7. **Consistent Design Language** - Same patterns across both game modes

---

## Existing Design Tokens

```js
// tailwind.config.js
colors: {
  field: { 50-950 }, // Football greens
  slate: { 850: '#1a1f2e', 950: '#0d1117' },
  gold: { 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706' }
}
fontFamily: { sans: ['Inter', ...] }
backgroundImage: {
  'field-gradient': 'linear-gradient(135deg, #064e3b 0%, #022c22 50%, #0d1117 100%)',
  'dark-gradient': 'linear-gradient(180deg, #1a1f2e 0%, #0d1117 100%)'
}
```

**Position Colors (current):**
- QB: Red
- RB: Blue
- WR: Green
- TE: Yellow
- K: Purple
- DEF: Gray

---

## User Personas

1. **Casual Fan** - Checks once a week, wants simple interface, mobile-heavy
2. **Hardcore Fantasy Player** - Wants all the data, compares stats, desktop user
3. **Commissioner** - Needs admin tools, runs the league, power user

---

Feel free to propose new components, layouts, color schemes, and interaction patterns. The goal is a cohesive, premium sports fantasy experience.
