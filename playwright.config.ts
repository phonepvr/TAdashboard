import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

// In this managed environment a Chromium is pre-installed at a fixed path; use it
// directly. In CI (where the path is absent) Playwright uses its own installed
// browser, so this stays undefined and the default applies.
const PREINSTALLED_CHROMIUM = '/opt/pw-browsers/chromium';
const executablePath = existsSync(PREINSTALLED_CHROMIUM) ? PREINSTALLED_CHROMIUM : undefined;

/**
 * Playwright runs against the PRODUCTION build served by `vite preview`, so the
 * meta-CSP and zero-egress behaviour are exercised exactly as deployed.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/tadashboard/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/tadashboard/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
