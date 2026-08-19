# Salary Cap Handoff Package

Design system for the Bobby 3-Stix Memorial salary cap league, built for
React 18 + Vite + TypeScript + Tailwind 3.4 + Supabase.

```
salarycap-handoff/
├── README.md                  ← you are here
├── DESIGN_SYSTEM.md           ← the seven rules; Code reads this first
├── tailwind.config.js         ← theme extension to merge
├── reference/renders.html     ← open in a browser to SEE the target
└── src/
    ├── lib/
    │   ├── types.ts           ← shared types
    │   └── cap.ts             ← league math (dead cap, max bid, cap summary)
    └── components/ui/
        ├── PlayerAvatar.tsx   ← photo well + position chip, RookieBadge
        ├── ContractDots.tsx   ← season-anchored contract length
        ├── CapLedgerBar.tsx   ← the shared-scale bar
        ├── CapWidget.tsx      ← sticky cap panel
        ├── Ticker.tsx         ← deadline countdown / progress
        ├── ContractRow.tsx    ← keep-cut row with impact reveal
        ├── AuctionStage.tsx   ← bid + clock hero
        └── index.ts
```

---

## Install (run these in terminal with Claude Code)

**1.** Copy this folder into your repo, e.g. `docs/salarycap-handoff/`.

**2.** Open Claude Code in your project root and paste:

> Read `docs/salarycap-handoff/DESIGN_SYSTEM.md` and `docs/salarycap-handoff/tailwind.config.js`.
>
> Merge the theme extension into my existing `tailwind.config.js`. Extend my current `field`, `slate`, and `gold` scales — do not wipe them. Flag the two overlapping values (`field.500`, `gold.500`) and ask me before changing either. Add the Fraunces + JetBrains Mono links to `index.html`.
>
> Then copy `src/lib/types.ts`, `src/lib/cap.ts`, and everything in `src/components/ui/` into the matching paths in my `src/`. Make sure it all typechecks against my tsconfig.
>
> Don't restyle any existing pages yet. Show me a diff before applying anything.

**3.** Review, approve. Then build screens one at a time:

> Rebuild `/salarycap` (dashboard) per DESIGN_SYSTEM.md. One sorted list of all 12 teams using `CapLedgerBar` on the shared scale, plus a `Ticker` for the roster lock deadline. Rows click through to the owner detail route. Pull team data from Supabase.

> Rebuild `/salarycap/my-team`. Three decision groups (under contract → `ContractRow`; franchise tag → single-select; free agent pickups → sign/release), sticky `CapWidget` in a right rail, read-only dead cap and bonus cap sections at the bottom. Use `summarizeCap()` so the widget updates live as decisions change.

---

## Two manual bits

**Fonts.** Add to `index.html` `<head>` — Inter you already load:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
```

**Headshots.** `PlayerAvatar` takes an optional `photoUrl` and falls back to initials. The position strip stays either way, so you can ship without images and add them later with no layout change.

---

## The rule that matters most

Every number uses `font-data` with `tabular-nums`. That one detail is what
separates this from a spreadsheet with a dark theme. If a salary or bid
renders in Inter, fix that first.

Second most important: **the cap ledger bar never rescales.** One $400
scale everywhere is the whole reason twelve teams can be compared by eye.

---

## When to come back to chat

Claude Code can't see its own output. When you've built a screen and aren't
sure whether it *looks* right — too busy, wrong hierarchy, something feels
off — screenshot it and bring it back. Build in terminal, judge visually in
chat.
