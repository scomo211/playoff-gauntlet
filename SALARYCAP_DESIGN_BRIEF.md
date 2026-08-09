# Salary Cap League - Design Brief

## League Overview

**Bobby 3-Stix Memorial Salary Cap League** is a 12-team dynasty fantasy football league with deep salary cap management, multi-year contracts, and a live auction draft.

### Core Mechanics at a Glance

| Attribute | Value |
|-----------|-------|
| Teams | 12 owners |
| Salary Cap | $400 (soft cap) |
| Roster Size | 24 players |
| Starters | 9 (1 QB, 2 RB, 3 WR, 1 TE, 2 Flex) |
| Scoring | 0.5 PPR, 6pt passing TD |
| Contract Length | 1-3 years (rookies: up to 5) |
| Annual Dues | $100 |

### Prize Structure
- Regular Season Winner: $300
- Playoff Champion: $700
- Runner-Up: $100
- Dynasty Pot: $100/year (win back-to-back or 2-of-3 to claim)

---

## Cap Formula

```
Available Cap = $400 + Bonus Cap − Rostered Salaries − Dead Cap
```

- **Bonus Cap**: Can be positive or negative from trades (spreads over 5 years)
- **Dead Cap**: Penalty from cutting players mid-contract (40% × salary × years remaining)
- Must be under cap by July 1st each year

---

## Pages to Design

### 1. Salary Cap Dashboard (`/salarycap`)

**Purpose:** League home showing all 12 teams at a glance

**Current State:**
- Simple list of teams with cap bars
- Franchise tag cost reference

**What Users Need to See:**
- Which teams are over/under cap
- Who has the most cap space
- Roster fullness (X/24)
- Recent transactions/moves
- Upcoming deadlines
- League standings (previous season finish)

**Design Problems:**
- No team identity (logos, colors, avatars)
- Cap bars are hard to compare across teams
- Feels like a spreadsheet, not a league home
- No activity feed or social element
- Missing "state of the league" overview

**Ideal Experience:**
- Team cards with visual identity for each owner
- At-a-glance cap health indicators (green/yellow/red)
- Quick-view hover or tap to see top players per team
- Activity feed showing recent cuts, tags, trades
- Countdown to next deadline (draft, offseason lock)

---

### 2. Team Detail (`/salarycap/team/:ownerId`)

**Purpose:** Deep dive into any team's roster, contracts, and cap situation

**Current Sections:**

1. **Progress Checklist** (own team only)
   - Contract decisions complete?
   - Franchise tag decided?
   - Free agent pickups decided?
   - Draft availability submitted?

2. **Cap Donut Chart**
   - Segments: Available (green), Salaries (amber), Dead Cap (red), Bonus Cap (blue)
   - Center shows available amount

3. **Draft Availability Calendar** (own team only)
   - Aug 18-24 time slot grid
   - Select available slots for live draft scheduling

4. **Under Contract Table** (blue border)
   - Columns: Position, Player, Salary, Years, Dead Cap, Decision
   - Actions: Keep / Cut buttons

5. **Franchise Tag Eligible** (amber border)
   - Radio selection: Tag one player OR release all
   - Shows tag cost calculation

6. **Free Agent Pickups** (purple border)
   - Mid-season pickups needing decisions
   - Actions: Sign ($5/1yr) / Release

7. **Dead Cap Table** (red border, read-only)
   - Historical cuts still counting against cap

8. **Bonus Cap Table** (blue border)
   - Trade cap exchanges by year (2026-2030)

**Design Problems:**
- Too many colored borders creating visual chaos
- Tables are repetitive and boring
- Donut chart is too small to read
- No visual feedback on decision impact ("Cutting X saves $Y but costs $Z dead cap")
- Calendar doesn't look like a calendar
- Keep/Cut buttons feel generic and high-stakes actions should feel weighty
- No confirmation or "what-if" preview before committing

**What Users Need:**
- Clear visualization of "what happens if I cut this player"
- Side-by-side comparison of keep vs cut scenarios
- Contract timeline view (when does each contract expire?)
- Salary breakdown by position
- Historical context (what did I pay for this player? when?)

**Ideal Experience:**
- Interactive cap simulator: drag players to "cut" pile, see cap impact live
- Contract cards instead of table rows
- Timeline view showing contract expirations
- "Decision Summary" before submitting that shows all changes
- Celebration/confirmation when decisions are locked in

---

### 3. My Team / Offseason (`/salarycap/my-team` or `/salarycap/offseason`)

**Purpose:** Make offseason decisions for your own team

**Same as Team Detail but with full edit capability**

**Additional Considerations:**
- This is a HIGH-STAKES page - decisions are permanent after lock
- Users need to feel confident before submitting
- Should feel like a "war room" experience

**Design Goals:**
- Clear progress indicator toward completion
- Undo capability before final submission
- Preview/summary of all changes
- Prominent "Submit" flow with confirmation
- Lock indicator after deadline passes

---

### 4. Free Agents (`/salarycap/free-agents`)

**Purpose:** Browse players available for the auction draft

**Current Elements:**
- Search box
- Team filter dropdown
- Position filter buttons (QB, RB, WR, TE)
- Simple table: Rank, Position, Player photo, Name, Team

**What's Missing:**
- No player value/projection data
- No indication of expected auction price
- No historical auction data ("went for $X last year")
- No watchlist/favorites functionality
- No sorting by projected value
- Rookie badge exists but no rookie-specific info (draft pick, college)

**What Users Need:**
- Understand player value before draft
- Build a target list / draft board
- See which positions are deep vs scarce
- Compare players within position
- Know which players are rookies (5-year contract eligible)

**Ideal Experience:**
- Tiered player rankings with visual tiers (Elite / Solid / Depth / Flier)
- Sortable by multiple criteria (rank, position, team, rookie status)
- "Add to watchlist" functionality
- Player cards with key stats/projections
- Position scarcity indicator ("Only 3 elite QBs available")
- Draft board builder (drag to rank your targets)

---

### 5. Auction Room (`/salarycap/auction`) ⭐ PRIORITY

**Purpose:** Live real-time auction draft with 12 concurrent owners

**This is the most complex and exciting page in the app.**

#### Current Layout (3-Column)

**Left Panel - Available Players:**
- Search box
- Position filter buttons
- Scrollable player list (100 max visible)
- Player rows: Avatar, Position badge, Name, Team, Rookie badge
- "Your turn to nominate!" banner when applicable
- Click player → opens nomination modal

**Center Panel - Active Auction:**
- **Player Card:**
  - Large avatar
  - Position badge, name, rookie indicator
  - NFL team
- **Bid Display:**
  - Current bid (large emerald number)
  - High bidder name
  - "(You!)" indicator if winning
- **Timer:**
  - Countdown seconds
  - Color transitions: Green (>15s) → Amber (5-15s) → Red (<5s)
  - Pulses when critical
- **Bid Controls:**
  - "+$1" quick bid button
  - Custom bid input
  - "Bid" button
  - Max bid indicator
  - Error messages
- **Status Messages:**
  - "You're winning!"
  - "Your roster is full"
  - "Waiting for nomination..."

**Recent Sales Log:**
- Last 20 completed auctions
- Format: Position | Player → Owner | $Amount

**Right Panel - Rosters:**
- **My Roster:**
  - "X/24 filled"
  - "$X cap left"
  - List of drafted players with prices
- **All Owners:**
  - Collapsible rows
  - Owner name, cap remaining, slots filled
  - Expand to see their drafted players
  - Green dot on current nominator

**Nomination Modal:**
- Player info
- Opening bid input ($1 minimum)
- Max bid reminder
- Cancel / Nominate buttons

**Status Banners:**
- "Draft not started" (amber)
- "Draft paused" (amber)
- "Draft complete!" (green) with link to assign contracts

#### Auction Mechanics

**Timer System:**
- First 50 nominations: 30 seconds, resets to 10s if bid under 10s
- After 50 nominations: 20 seconds, resets to 5s if bid under 5s
- Timer stored as absolute timestamp (clients calculate locally)

**Bidding Rules:**
- Must bid > current bid
- Max bid = Remaining Cap − (Empty Slots − 1)
- Example: $100 cap, 5 slots left → max bid is $96

**Draft Completion:**
- Ends when all 288 roster spots filled (12 teams × 24)
- Contract years assigned post-draft

#### Design Problems

**Timer & Urgency:**
- Timer doesn't feel urgent enough
- No sound effects
- Minimal animation on time running out
- No visual "going once, going twice" moment

**Bidding Experience:**
- Controls are cramped
- No bid history visible during active auction
- Can't see WHO is bidding against you
- No "outbid!" notification/animation
- "+$1" is the main action but button is small

**Information Density:**
- Player card shows minimal info (no stats, no value context)
- Hard to assess if bid is good value
- No "market price" reference

**Social/Competition:**
- Can't see bid war happening in real-time
- No indication of who's actively bidding
- Owner list is just text - no personality
- No chat or reactions

**Mobile Experience:**
- 3-column layout doesn't work on mobile
- Critical for owners who can't be at computer

**Post-Nomination Flow:**
- After winning, unclear what happens next
- No celebration moment
- Contract assignment is separate page (disconnected)

#### Ideal Auction Room Experience

**The Feel:**
- ESPN draft room energy
- Sportsbook betting excitement
- Poker table tension
- Stock trading floor urgency

**Timer Redesign:**
- Large, central countdown
- Dramatic animations as time runs out
- Sound effects (optional, toggle-able): tick, warning beep, sold gavel
- "GOING ONCE... GOING TWICE..." visual state
- Screen flash or shake on final seconds

**Bidding Redesign:**
- Huge "+$1" button (most common action)
- Bid ladder: +$1, +$5, +$10, Custom
- One-tap bidding (no confirm needed for +$1)
- "OUTBID!" animation when someone beats you
- Your current max bid always visible
- "I'm out" indicator when you can't afford

**Live Activity Feed:**
- Show bids as they happen: "Scott bid $47" → "Tim bid $48" → "Johnny bid $49"
- Avatars/colors for each bidder
- Creates "bid war" narrative

**Player Card Redesign:**
- Larger player photo (hero image)
- Key stats: Last season points, ADP, expert consensus rank
- "Market value" estimate based on similar players
- Position scarcity context ("1 of 3 elite QBs left")
- Rookie badge prominent (5-year contract!)

**Owner Presence:**
- Show who's "active" (recently bid or nominated)
- Owner avatars/team colors
- "Watching" indicator
- Cap remaining as visual bar, not just number
- Highlight when owner is close to full roster

**Mobile Layout:**
- Stack to single column
- Player card + timer + bid button always visible
- Swipe to see owners/roster
- Critical info above fold

**Celebration Moments:**
- "SOLD!" animation when auction closes
- Winner's name prominently displayed
- Confetti or highlight for big wins
- Running tally of your draft so far

**Nomination Experience:**
- Your turn = spotlight moment
- Countdown to nominate (don't stall the draft)
- Quick-pick from favorites/watchlist
- Auto-suggest based on draft board

---

### 6. Contract Assignment (Post-Draft)

**Purpose:** After winning players at auction, assign contract lengths

**Current State:** Unclear/not fully built

**What's Needed:**
- List of all auction wins
- For each: Choose 1, 2, or 3 years (or 1-5 for rookies)
- Show cap impact per year
- Show total committed salary by year
- Deadline indicator

**Design Considerations:**
- Should feel like "completing" the draft
- Visual representation of roster construction
- Year-by-year cap projection after assignments

---

### 7. Rules Page (`/salarycap/rules`)

**Purpose:** Reference for all league rules and mechanics

**Current Sections:**
- Roster & Scoring
- Salary Cap
- Contracts
- Trades
- Schedule
- Playoffs
- Payouts

**Design Goal:**
- Searchable/navigable
- Examples and calculations
- Visual explanations where possible
- FAQ format for common questions

---

## Design System Considerations

### Color Palette for Salary Cap

**Cap Health:**
- Green: Healthy cap space (>$50 available)
- Amber: Tight cap (<$50 available)
- Red: Over cap or near limit

**Contract Status:**
- Blue: Active contract
- Amber: Expiring (1 year left)
- Red: Expired (needs decision)
- Purple: Free agent pickup

**Positions:**
- QB: Red/Rose
- RB: Blue
- WR: Green/Emerald
- TE: Yellow/Amber
- K: Purple
- DEF: Gray

**Auction States:**
- Active bidding: Emerald glow
- Going once: Amber pulse
- Going twice: Red urgent
- Sold: Gold celebration

### Key UI Patterns Needed

1. **Cap Bar Component**
   - Visual bar showing cap breakdown
   - Hover/tap for detailed breakdown
   - Color-coded segments

2. **Player Card Component**
   - Photo, name, position, team
   - Contract info (salary, years)
   - Stats/projections
   - Action buttons contextual to page

3. **Contract Row Component**
   - Compact display for tables
   - Expandable for details
   - Decision buttons integrated

4. **Owner Card Component**
   - Avatar/identity
   - Cap summary
   - Roster progress
   - Activity indicator

5. **Timer Component**
   - Large countdown display
   - Color transitions
   - Animation states
   - Sound integration (optional)

6. **Bid Button Component**
   - Primary action styling
   - Disabled states
   - Loading/processing state
   - Success/error feedback

### Animation & Motion

**Auction Room (high energy):**
- Bid amounts animate up
- Timer pulses as time runs low
- "Outbid" shake/flash
- "Sold" celebration burst
- Player card transitions in/out

**Offseason Pages (deliberate):**
- Smooth transitions between decisions
- Cap chart updates smoothly
- Confirmation animations for decisions
- Progress celebrations

### Sound Design (Optional/Toggle-able)

**Auction:**
- Bid placed: subtle click
- Outbid: alert tone
- 10 seconds left: warning beep
- 5 seconds left: urgent beeping
- Sold: gavel sound
- Your win: celebration chime

---

## User Flows

### Flow 1: Offseason Decisions

```
1. View My Team page
2. Review Under Contract players
   → For each: Decide Keep or Cut
   → See cap impact of each decision
3. Review Expired Contracts
   → Choose one for Franchise Tag (or none)
   → See tag cost and cap impact
4. Review Free Agent Pickups
   → For each: Sign ($5) or Release
5. Set Draft Availability
   → Select available time slots
6. Review Summary
   → See all decisions and total cap impact
7. Submit Decisions
   → Confirmation modal
   → Locked in after deadline
```

### Flow 2: Auction Draft

```
1. Enter Auction Room
   → See current state (not started / active / your turn)
2. Browse Available Players (left panel)
   → Search/filter
   → Review targets
3. When Your Turn to Nominate:
   → Select player from list
   → Set opening bid
   → Confirm nomination
4. During Active Auction:
   → Watch current bid
   → Decide to bid or pass
   → Quick-bid +$1 or custom amount
   → Monitor timer
5. When You Win:
   → Celebration moment
   → Player added to roster
   → Cap updated
6. Monitor Other Auctions:
   → Watch prices for market info
   → Track competitor rosters
   → Manage your cap
7. Draft Complete:
   → Assign contract years to wins
   → Review final roster
```

### Flow 3: Mid-Season (Future)

```
1. Trade proposals
2. Waiver wire / FAAB bidding
3. Lineup management
4. Standings tracking
```

---

## Mobile Considerations

**Critical Mobile Pages:**
- Auction Room (owners may be remote during draft)
- My Team (quick checks on cap/roster)
- Dashboard (league overview)

**Mobile Auction Room Requirements:**
- One-thumb bidding capability
- Timer always visible
- Current bid prominent
- Swipe navigation between panels
- Push notifications for "your turn" and "outbid"

---

## Success Metrics

**Auction Room:**
- Bid response time (< 500ms feedback)
- Missed nominations (owner didn't nominate in time)
- Session stability (no disconnects)
- Mobile vs desktop usage

**Offseason:**
- Decision completion rate before deadline
- Time to complete all decisions
- Error rate (invalid decisions)

**Overall:**
- Owner engagement (logins, time in app)
- Draft completion rate
- League retention year-over-year
