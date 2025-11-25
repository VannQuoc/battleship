/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sea: {
          950: '#020617', // Map Background (Darkest)
          900: '#0f172a', // Deep Sea Blue (App Background)
          800: '#1e293b', // Panels
          700: '#334155', // Fog of War
        },
        radar: {
          DEFAULT: '#10b981', // Radar Green (Friendly/Safe)
          dim: '#059669',
          glow: '#34d399',
        },
        alert: {
          DEFAULT: '#ef4444', // Alert Red (Enemy/Danger)
          dim: '#991b1b',
        },
        hologram: {
          DEFAULT: '#06b6d4', // Cyan (Tech/Grid)
          dim: '#0891b2',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'], // Font cho số liệu/tọa độ
      },
      animation: {
        'scan': 'scan 3s linear infinite',
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        }
      }
    },
  },
  plugins: [],
}