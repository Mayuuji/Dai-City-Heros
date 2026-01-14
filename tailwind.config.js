/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          dark: '#0a0e27',
          darker: '#050816',
          blue: '#00d9ff',
          cyan: '#00fff9',
          magenta: '#ff00ff',
          purple: '#bd00ff',
          pink: '#ff006e',
          green: '#39ff14',
        },
      },
      fontFamily: {
        mono: ['Courier New', 'monospace'],
        cyber: ['Orbitron', 'sans-serif'],
      },
      boxShadow: {
        'neon-cyan': '0 0 5px #00fff9, 0 0 20px #00fff9',
        'neon-magenta': '0 0 5px #ff00ff, 0 0 20px #ff00ff',
        'neon-green': '0 0 5px #39ff14, 0 0 20px #39ff14',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flicker': 'flicker 2s infinite',
      },
      keyframes: {
        flicker: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
      },
    },
  },
  plugins: [],
}
