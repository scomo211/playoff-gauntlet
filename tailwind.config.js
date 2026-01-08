/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Football field green
        field: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
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
        // Gold accents
        gold: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      backgroundImage: {
        'field-gradient': 'linear-gradient(135deg, #064e3b 0%, #022c22 50%, #0d1117 100%)',
        'dark-gradient': 'linear-gradient(180deg, #1a1f2e 0%, #0d1117 100%)',
      },
      animation: {
        'bounce-once': 'bounce-once 0.5s ease-out',
      },
      keyframes: {
        'bounce-once': {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '50%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
