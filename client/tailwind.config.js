/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        sea: {
          900: '#0f172a', // Deep Sea
          800: '#1e293b',
          700: '#334155', // Fog
        },
        radar: {
          DEFAULT: '#10b981', // Green - Ally/Safe
          dim: 'rgba(16, 185, 129, 0.2)',
        },
        alert: {
          DEFAULT: '#ef4444', // Red - Enemy/Danger
        },
        holo: {
          DEFAULT: '#06b6d4', // Cyan - UI/Grid
        }
      },
      backgroundImage: {
        'grid-pattern': "linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)",
      }
    },
  },
  plugins: [],
}