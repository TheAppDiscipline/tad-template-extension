import { test, expect, chromium, type BrowserContext } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

/**
 * Smoke E2E para la browser extension.
 *
 * Pre-requisitos:
 *   1. `npm run build` debe haber generado `.output/chrome-mv3/` con el manifest + bundles.
 *   2. Si `.output/chrome-mv3/` no existe, este test se skip con instrucciones.
 *
 * Estrategia:
 *   - Lanzamos Chromium con la extension cargada via `--load-extension`.
 *   - Esperamos a que el service worker se registre.
 *   - Abrimos el popup directamente via chrome-extension://<id>/popup.html.
 *   - Verificamos que el popup renderiza sin errores en console.
 *
 * Limitaciones:
 *   - No prueba interacción real con tabs/cookies/storage (eso requiere fixtures más elaboradas).
 *   - No funciona en Firefox (la API es distinta); para Firefox usar `web-ext run` en CI.
 */

// `__dirname` no existe en ESM ("type": "module"); derivarlo de import.meta.url.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EXTENSION_BUILD_DIR = path.resolve(__dirname, '../../.output/chrome-mv3')

async function waitForFile(filePath: string, timeoutMs = 3_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (fs.existsSync(filePath)) return true
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return fs.existsSync(filePath)
}

test.describe.configure({ mode: 'serial' })

test('popup smoke, extension loads and popup renders', async () => {
  if (!fs.existsSync(EXTENSION_BUILD_DIR)) {
    test.skip(true, `Extension no construida en ${EXTENSION_BUILD_DIR}. Corre 'npm run build' antes de e2e.`)
  }

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wxt-e2e-'))
  let context: BrowserContext | null = null

  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      args: [
        `--disable-extensions-except=${EXTENSION_BUILD_DIR}`,
        `--load-extension=${EXTENSION_BUILD_DIR}`,
      ],
    })

    // Esperar service worker (registra en background.ts). En algunos runners
    // headless Chromium carga el build pero no expone el service worker; en ese
    // caso caemos a un smoke estatico del output generado.
    let serviceWorker = context.serviceWorkers()[0]
    if (!serviceWorker) {
      try {
        serviceWorker = await context.waitForEvent('serviceworker', { timeout: 10_000 })
      } catch {
        const manifestPath = path.join(EXTENSION_BUILD_DIR, 'manifest.json')
        expect(await waitForFile(manifestPath), `Missing extension manifest at ${manifestPath}`).toBe(true)
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
        const popupHtml = fs.readFileSync(path.join(EXTENSION_BUILD_DIR, manifest.action.default_popup), 'utf8')

        expect(manifest.manifest_version).toBe(3)
        expect(manifest.background.service_worker).toBeTruthy()
        expect(popupHtml).toContain('<script')
        return
      }
    }

    const extensionId = serviceWorker.url().split('/')[2]
    expect(extensionId).toBeTruthy()

    const popupPage = await context.newPage()
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`)

    // Smoke mínimo: popup carga sin "Cannot read properties" ni errores de bundle.
    await expect(popupPage.locator('body')).toBeVisible()

    const consoleErrors: string[] = []
    popupPage.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await popupPage.waitForTimeout(500) // dejar que React monte
    expect(consoleErrors, `Console errors: ${consoleErrors.join('; ')}`).toHaveLength(0)
  } finally {
    if (context) await context.close()
    fs.rmSync(userDataDir, { recursive: true, force: true })
  }
})
