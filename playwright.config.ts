import { defineConfig, devices } from '@playwright/test'

// E2E smoke para extension Manifest V3.
// Requiere: `npm run build` antes de correr e2e (Playwright carga el extension desde .output/chrome-mv3/).
// El test arranca Chromium con la extension cargada y verifica el popup.
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
