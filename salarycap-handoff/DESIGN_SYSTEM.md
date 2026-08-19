# Bobby 3-Stix Salary Cap — Design System

> Read this before building or restyling any UI in this app.
> Stack: React 18 + Vite + TypeScript + Tailwind 3.4 + Supabase.
> Open `reference/renders.html` in a browser to see the target.

## The idea in one line

A precision instrument for a twelve-person dynasty league. Calm chrome, disciplined color, and numbers that read like a well-set scoreboard. Every competitor shouts; this one doesn't, so the only thing that gets loud is the money.

---

## The seven rules

These are what make a **new** page look like it belongs. Apply them to any screen not yet built.

### 1. One cap ledger bar, one scale, everywhere
Every cap bar spans the same `baseCap + bonusCap` total, with the same stacked segments in the same order: salaries → dead cap → available. This is what lets you compare twelve teams by eye instead of by arithmetic. Never rescale a bar to fit its own container. Use `<CapLedgerBar />`.

### 2. Every number is mono with tabular figures
Salaries, bids, cap totals, countdowns, roster counts, prices. `font-data tabular-nums`. This single detail is what makes the app feel trustworthy rather than like a spreadsheet with a dark theme. If a number renders in Inter, that's a bug.

### 3. Position color is text on a tinted chip — never a solid fill
Six saturated position tiles would compete with the primary action. Position color appears only as colored text on a dark strip or chip. Use `<PlayerAvatar />`, which handles this.

### 4. Contract length is shown with season-anchored dots, not text
Five dot slots representing `'26 '27 '28 '29 '30`. Filled dots = seasons still owed. Because all rows share the same slots, the roster becomes a contract timeline you can scan vertically. Never write "2 yrs left" as body text. Use `<ContractDots />`.

### 5. Decision groups differentiate by control type, not border color
Under contract → Keep/Cut toggle. Franchise tag → single-select radio (others dim). Free agents → Sign/Release. Three different affordances teach three different rules without instruction. **Do not give sections colored borders** — that was the original design's biggest failure.

### 6. Dead cap and bonus cap are ledger facts, not roster decisions
They never get decision controls and never sit among the players. They live as summary lines in `<CapWidget />` and as read-only sections at the bottom of the page.

### 7. One job, one hero, one primary action per page
Dashboard: compare twelve teams. My Team: make decisions while watching the cap. Auction: read the bid and the clock. Everything else on a page must visibly support that job or move behind a tap. When adding an element, ask what it displaces.

---

## Color roles

Color is rationed. Four semantic colors plus position chips — that's the whole palette.

| Token | Hex | Means |
|---|---|---|
| `field-500` | #2E9E63 | Available cap, keep, primary action |
| `flag` | #F0562E | Dead cap, cut, urgent/critical |
| `gold-500` | #E8B437 | Money, franchise tag, sold, rookie |
| `amber` | #E0A32E | Tight cap, warning state |
| `salary` | #39485c | Salary segment of the ledger (neutral on purpose) |
| `surface`, `surface-panel`, `surface-well` | — | Background stack |
| `hairline`, `hairline-strong` | — | Dividers and control borders |
| `fg`, `fg-muted`, `fg-subtle` | — | Text hierarchy |
| `pos-qb/rb/wr/te/k/def` | — | Position chip text only |

**Cap health thresholds:** available < 0 → `flag`; < $50 → `amber`; otherwise `field-500`. Use `capHealth()` from `lib/cap.ts`.

---

## Typography

- **Display** — `font-display` (Fraunces 600). Page titles, section headings, player name on the auction stage. Used with restraint.
- **Body/UI** — `font-sans` (Inter). Everything else.
- **Data** — `font-data` (JetBrains Mono) + `tabular-nums`. Every number, plus small uppercase labels.
- **Labels** — `font-data text-[10.5px] uppercase tracking-[0.14em] text-fg-subtle`.

---

## Spacing and shape

- 8pt system; stick to Tailwind's default scale.
- Radius: `rounded-well` (11px) avatars/inputs, `rounded-card` (14px) cards, `rounded-panel` (20px) rails, `rounded-hero` (26px) the auction stage, `rounded-full` buttons and pills.
- Rows: `py-3` with `border-b border-hairline`, last row `border-none`.

---

## Motion

Restrained and meaningful. Bid changes bump once. Live indicators pulse. Urgent countdowns blink. Nothing else animates.

**Everything must be gated:** use `motion-safe:` on every animated utility. The auction's critical state is deliberately attention-grabbing and must respect reduced motion.

---

## Copy voice

- Active voice, sentence case. Buttons say what happens: "Set lineup," not "Submit."
- An action keeps its name through the flow: a "Cut" button produces a "CUT" state label.
- Section headers state the rule in one sentence: "Tag one player for a year at the tag price — the rest hit free agency."
- Empty states invite: "No players match those filters."
- Errors explain what happened and how to fix it. Never vague, never apologetic.

---

## League rules encoded in `lib/cap.ts`

Don't reimplement these inline — import them.

```
Available = baseCap + bonusCap − salaries − deadCap
Dead cap if cut = 0.4 × salary × yearsRemaining
Max bid = capRemaining − (emptySlots − 1)
```

Cap is $400 soft. Rosters are 24. Contracts run 1–3 years, rookies up to 5.

---

## Component inventory (`src/components/ui`)

| Component | Purpose |
|---|---|
| `PlayerAvatar` | Photo well + position chip strip. Drop in `photoUrl` when you have headshots. |
| `ContractDots` | Season-anchored contract length. `ContractYearLabels` for the aligned header. |
| `RookieBadge` | Gold R. Use anywhere a player is listed. |
| `CapLedgerBar` | The shared-scale bar. |
| `CapWidget` | Sticky cap panel with breakdown lines and jump links. |
| `Ticker` | Countdown to a deadline, or progress variant. |
| `ContractRow` | Keep/cut row with reveal-on-cut impact math. |
| `AuctionStage` | Bid + clock + action, horizontal layout. |

Build new components to match these patterns. **When in doubt, choose the quieter option.**
