/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ---- surfaces (dark stack) ----
        surface: {
          DEFAULT: '#0d1117', // app background
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
        // ---- Football field green (merged with new design system) ----
        field: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#2E9E63', // NEW: tuned for contrast on dark bg
          600: '#25834F', // NEW: darker variant
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        // Dark slate/charcoal
        slate: {
          850: '#1a1f2e',
          950: '#0d1117',
        },
        // Gold accents (merged with new design system)
        gold: {
          400: '#fbbf24',
          500: '#E8B437', // NEW: yellow-gold for money, tags, sold, rookie
          600: '#C89A2E', // NEW: darker variant
        },
        // ---- semantic accents ----
        flag:  '#F0562E', // dead cap, cut, urgent
        amber: '#E0A32E', // tight cap, warning
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
        sans:    ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        data:    ['"JetBrains Mono"', 'monospace'], // ALL numbers
      },
      fontSize: {
        display: ['29px', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        bid:     ['58px', { lineHeight: '0.95', letterSpacing: '-0.04em' }],
        cap:     ['30px', { lineHeight: '1',    letterSpacing: '-0.02em' }],
      },
      borderRadius: {
        well:  '11px',
        card:  '14px',
        panel: '20px',
        hero:  '26px',
      },
      backgroundImage: {
        'field-gradient': 'linear-gradient(135deg, #064e3b 0%, #022c22 50%, #0d1117 100%)',
        'dark-gradient': 'linear-gradient(180deg, #1a1f2e 0%, #0d1117 100%)',
      },
      keyframes: {
        'bounce-once': {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '50%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseDot: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.3' } },
        bidBump:  { '40%': { transform: 'scale(1.06)' } },
      },
      animation: {
        'bounce-once': 'bounce-once 0.5s ease-out',
        'pulse-dot': 'pulseDot 1.3s ease-in-out infinite',
        'bid-bump':  'bidBump .3s ease',
      },
    },
  },
  plugins: [],
}
