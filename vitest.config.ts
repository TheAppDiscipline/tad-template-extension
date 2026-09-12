import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Exclude Playwright E2E tests; they run via `npm run e2e`, not via vitest.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.output/**', '**/.wxt/**', 'tests/e2e/**'],
    // B10: tooling tests launch tsx subprocesses (spawnSync) whose first
    // import is slow in CI/loaded machines. The 5s default causes
    // spurious timeouts (fail closed). Raising it to 30s removes fragility without hiding real failures.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
})
