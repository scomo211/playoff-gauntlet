/**
 * BOBBY 3-STIX DESIGN SYSTEM — Tailwind theme extension
 * ---------------------------------------------------------------
 * MERGE the `extend` block below into your existing tailwind.config.js.
 * You already have: field (50–950), slate (850/950), gold (400–600),
 * Inter, field-gradient, dark-gradient, bounce-once. KEEP ALL OF IT.
 * This adds new keys and only overlaps on two (see NOTE below).
 *
 * Fonts to add in index.html <head> (Inter already loaded):
 * <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
 *
 * NOTE — two deliberate overlaps, decide before merging:
 *   field.500 → #2E9E63  (tuned for contrast on #0d1117)
 *   gold.500  → #E8B437  (yours is #f59e0b, noticeably more orange)
 * If you prefer your existing values, keep them — nothing else breaks.
 * Everything else below is additive.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ---- surfaces (dark stack) ----
        surface: {
          DEFAULT: '#0d1117', // = your slate.950, app background
          panel:   '#151b24', // raised cards / rails
          well:    '#1e2530', // inputs, photo wells, inset chips
        },
        hairline: {
          DEFAULT: '#232b36', // row dividers, card borders
          strong:  '#2f3846', // control borders, emphasis rules
        },
        // ---- foreground text ----
        fg: {
          DEFAULT: '#EAEEF3', // primary
          muted:   '#8E99A8', // secondary
          subtle:  '#59626F', // tertiary, labels, units
        },
        // ---- semantic accents (rationed — see DESIGN_SYSTEM.md) ----
        field: { 500: '#2E9E63', 600: '#25834F' }, // available cap, keep, primary action
        gold:  { 500: '#E8B437', 600: '#C89A2E' }, // money, franchise tag, sold, rookie
        flag:  '#F0562E',                          // dead cap, cut, urgent
        amber: '#E0A32E',                          // tight cap, warning
        // ---- position colors: TEXT ON TINTED CHIPS ONLY, never solid fills ----
        pos: {
          qb:  '#E0685E',
          rb:  '#6B9BE0',
          wr:  '#4FC08A',
          te:  '#E0B45E',
          k:   '#A98CE0',
          def: '#8E99A8',
        },
        // salary segment of the cap ledger bar (deliberately neutral)
        salary: '#39485c',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        data:    ['"JetBrains Mono"', 'monospace'], // ALL numbers
      },
      fontSize: {
        display: ['29px', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        bid:     ['58px', { lineHeight: '0.95', letterSpacing: '-0.04em' }],
        cap:     ['30px', { lineHeight: '1',    letterSpacing: '-0.02em' }],
      },
      // custom names so we don't override Tailwind's global rounded-* scale
      borderRadius: {
        well:  '11px',
        card:  '14px',
        panel: '20px',
        hero:  '26px',
      },
      keyframes: {
        pulseDot: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.3' } },
        bidBump:  { '40%': { transform: 'scale(1.06)' } },
      },
      animation: {
        // keep your existing bounce-once
        'pulse-dot': 'pulseDot 1.3s ease-in-out infinite',
        'bid-bump':  'bidBump .3s ease',
      },
    },
  },
  plugins: [],
}
