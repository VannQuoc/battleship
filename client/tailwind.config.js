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
          950: '#020617',
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
          600: '#475569',
        },
        radar: {
          DEFAULT: '#10b981',
          dim: '#059669',
          glow: '#34d399',
          light: '#6ee7b7',
        },
        alert: {
          DEFAULT: '#ef4444',
          dim: '#991b1b',
          glow: '#f87171',
        },
        hologram: {
          DEFAULT: '#06b6d4',
          dim: '#0891b2',
          glow: '#22d3ee',
        },
      },
      fontFamily: {
        sans: ['"JetBrains Mono"', 'monospace'],
        mono: ['"JetBrains Mono"', 'monospace'],
        display: ['"Orbitron"', 'sans-serif'],
      },
      animation: {
        'scan': 'scan 3s linear infinite',
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'radar-sweep': 'radarSweep 4s linear infinite',
        'glow': 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '50%': { opacity: '1' },
          '100%': { transform: 'translateY(100%)', opacity: '0' },
        },
        radarSweep: {
          'from': { transform: 'rotate(0deg)' },
          'to': { transform: 'rotate(360deg)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 5px currentColor, 0 0 10px currentColor' },
          '50%': { boxShadow: '0 0 20px currentColor, 0 0 30px currentColor' },
        },
      },
      backgroundImage: {
        'grid-pattern': `
          linear-gradient(to right, rgba(30, 41, 59, 0.5) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(30, 41, 59, 0.5) 1px, transparent 1px)
        `,
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      backgroundSize: {
        'grid': '20px 20px',
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(6, 182, 212, 0.3)',
        'glow-green': '0 0 20px rgba(16, 185, 129, 0.3)',
        'glow-red': '0 0 20px rgba(239, 68, 68, 0.3)',
        'inner-glow': 'inset 0 0 20px rgba(6, 182, 212, 0.1)',
      },
    },
  },
  plugins: [],
}
