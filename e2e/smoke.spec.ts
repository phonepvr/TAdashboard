import { test, expect } from '@playwright/test';

const ORIGIN = 'http://localhost:4173';

test('demo → map → data-quality readout, fully offline + CSP present', async ({ page }) => {
  const external: string[] = [];

  await page.goto('./');

  // (1) The zero-egress CSP is delivered via <meta> (GitHub Pages can't set headers).
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("connect-src 'none'");

  // (2) From now on, ANY request to a non-local origin is a privacy failure.
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith(ORIGIN) && !url.startsWith('data:') && !url.startsWith('blob:')) {
      external.push(url);
    }
  });

  // (3) Load synthetic demo data (generated in-code; no file, no network).
  await page.getByRole('button', { name: /Load synthetic demo data/i }).click();

  // (4) Mapping screen appears (parsed + auto-mapped in the worker).
  await expect(page.getByRole('heading', { name: /Map your columns/i })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Confirm .* analyze/i }).first().click();

  // (5) Data-quality readout renders (normalized + de-duped + scored).
  await expect(page.getByText(/Data-quality score/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Field completeness/i)).toBeVisible();
  await expect(page.getByText('DEMO DATA')).toBeVisible();

  // (6) An interaction (toggle a privacy control) — still no egress.
  await page.getByRole('switch', { name: /Private drill-down/i }).click();

  expect(external, `unexpected external requests: ${external.join(', ')}`).toHaveLength(0);
});
