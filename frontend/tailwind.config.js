/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Base surfaces (light, near-white) ──────────────────
        background:   '#F7F8FA',   // Main page background
        sidebar:      '#FAFBFC',   // Navigation panels
        surface:      '#FFFFFF',   // Cards & panels
        border:       '#E4E7EC',   // Borders

        // ── Text ──────────────────────────────────────────────
        'text-primary':   '#101828',   // Primary text (near-black)
        'text-secondary': '#667085',   // Muted gray
        'text-disabled':  '#98A2B3',   // Very muted

        // ── Accents ───────────────────────────────────────────
        'accent-purple':  '#6D4FE0',   // Primary purple
        'brand-purple':   '#6D4FE0',
        'accent-red':     '#F04438',   // Red
        'accent-amber':   '#F79009',   // Amber
        'accent-blue':    '#2E90FA',   // Blue
        'accent-green':   '#12B76A',   // Green
        'accent-pink':    '#EE46BC',   // Pink
        'accent-cyan':    '#06AED4',   // Cyan
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      animation: {
        'marquee-left':    'marquee-left 30s linear infinite',
        'marquee-right':   'marquee-right 30s linear infinite',
        'gradient-shift':  'gradient-shift 5s ease infinite',
        'glow-pulse':      'glow-pulse 2.5s ease-in-out infinite',
        'float':           'float 3.5s ease-in-out infinite',
        'fade-in-up':      'fade-in-up 0.4s ease-out both',
        'slide-in':        'slide-in 0.3s ease-out both',
        'badge-pop':       'badge-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'shimmer':         'shimmer 2s linear infinite',
        'pulse-soft':      'pulse-soft 3s ease-in-out infinite',
      },
      keyframes: {
        'marquee-left': {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'marquee-right': {
          '0%':   { transform: 'translateX(-50%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%':      { backgroundPosition: '100% 50%' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 8px 2px rgba(109,79,224,0.25)' },
          '50%':      { boxShadow: '0 0 22px 8px rgba(109,79,224,0.45)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-7px)' },
        },
        'fade-in-up': {
          '0%':   { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%':   { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'badge-pop': {
          '0%':   { transform: 'scale(0)' },
          '100%': { transform: 'scale(1)' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
}
