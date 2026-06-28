/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter Variable',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        // Restrained executive palette: one accent + neutral slate + semantic status.
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        good: { 50: '#f0fdf4', 500: '#16a34a', 600: '#15803d' },
        warn: { 50: '#fffbeb', 500: '#d97706', 600: '#b45309' },
        critical: { 50: '#fef2f2', 500: '#dc2626', 600: '#b91c1c' },
        // 'demo' badge accent (distinct from brand) for synthetic-data mode.
        demo: { 50: '#fdf4ff', 500: '#a21caf', 600: '#86198f' },
      },
    },
  },
  plugins: [],
};
