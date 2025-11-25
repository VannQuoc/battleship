/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        sea: {
          900: '#0f172a', // Deep Sea Blue
          800: '#1e293b',
        },
        radar: {
          DEFAULT: '#10b981', // Radar Green
          dim: '#059669',
        },
        alert: {
          DEFAULT: '#ef4444', // Alert Red
        },
        hologram: {
          DEFAULT: '#06b6d4', // Cyan
        },
        fog: '#334155',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'], // Terminal font style
      },
      backgroundImage: {
        'grid-pattern': "linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)",
      }
    },
  },
  plugins: [],
}