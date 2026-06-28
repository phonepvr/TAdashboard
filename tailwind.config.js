/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // AM/NS primary typeface: Albert Sans (self-hosted woff2, zero network).
        sans: [
          'Albert Sans Variable',
          'Albert Sans',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        // AM/NS brand palette (ArcelorMittal Nippon Steel India brand guidelines).
        brand: {
          50: '#fdf2f2',
          100: '#fce4e4',
          200: '#f9c3c3',
          300: '#f49797',
          400: '#ee5f5f',
          500: '#e52726', // Smart Red
          600: '#cc1414',
          700: '#a81010',
          800: '#8b0d0d',
          900: '#6b0a0a',
        },
        good: { 50: '#f0fdf4', 500: '#16a34a', 600: '#15803d' },
        warn: { 50: '#fffbeb', 500: '#d97706', 600: '#b45309' },
        critical: { 50: '#fef2f2', 500: '#dc2626', 600: '#b91c1c' },
        demo: { 50: '#fdf4ff', 500: '#a21caf', 600: '#86198f' },
        amns: {
          yellow: '#FFA700',
          green: '#C0F353',
          blue: '#A8E0FF',
          black: '#000000',
        },
      },
    },
  },
  plugins: [],
};
