/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  // Project-pages base path: assets resolve under https://<user>.github.io/tadashboard/
  base: '/tadashboard/',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // No source maps in production: bundled logic/strings are not trivially
    // re-derivable from the public site.
    sourcemap: false,
    // Avoid the inline module-preload polyfill so script-src 'self' needs no inline allowance.
    modulePreload: { polyfill: false },
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
  worker: { format: 'es' },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
