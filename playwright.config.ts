import { defineConfig, devices } from '@playwright/test';

/**
 * Browser end-to-end tests. Start them with `pnpm e2e` (e2e/run.ts): it creates
 * the database, starts the API and the web app, then runs this configuration with
 * E2E_BASE_URL / E2E_API_URL pointing at them.
 *
 * One worker: the tests share one organisation and some of them change it
 * (approve a user, edit a policy), so they run in file order.
 */
export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:1520',
    // Arabic first (decision 9): the default language of the product.
    locale: 'ar-SA',
    timezoneId: 'Asia/Riyadh',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], locale: 'ar-SA' } }],
});
