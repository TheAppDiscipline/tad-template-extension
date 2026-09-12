import { defineConfig, devices } from '@playwright/test'

// E2E smoke for the Manifest V3 extension.
// Requires `npm run build` before running e2e (Playwright loads the extension from .output/chrome-mv3/).
// The test starts Chromium with the extension loaded and verifies the popup.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false, // extensions necesitan persistent context
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium-extension',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
