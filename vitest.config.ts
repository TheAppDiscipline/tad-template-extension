import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Excluir tests E2E de Playwright; corren via `npm run e2e`, no via vitest.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.output/**', '**/.wxt/**', 'tests/e2e/**'],
    // B10: los tests de tooling lanzan subprocesos tsx (spawnSync) cuya primera
    // importación es lenta en CI/máquinas cargadas. El default de 5s da timeouts
    // espurios (falla cerrado). Subir a 30s elimina la fragilidad sin ocultar fallas reales.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
})
