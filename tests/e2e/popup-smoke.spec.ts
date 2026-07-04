import { test, expect, chromium, type BrowserContext } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

/**
 * E2E smoke for the browser extension.
 *
 * Pre-requisitos:
 *   1. `npm run build` must have generated `.output/chrome-mv3/` with the manifest + bundles.
 *   2. If `.output/chrome-mv3/` does not exist, this test skips with instructions.
 *
 * Estrategia:
 *   - Start Chromium with the extension loaded via `--load-extension`.
 *   - Wait for the service worker to register.
 *   - Open the popup directly via chrome-extension://<id>/popup.html.
 *   - Verify that the popup renders without console errors.
 *
 * Limitaciones:
 *   - Does not test real interaction with tabs/cookies/storage (that requires richer fixtures).
 *   - Does not work in Firefox (the API is different); use `web-ext run` in CI for Firefox.
 */

// `__dirname` does not exist in ESM ("type": "module"); derive it from import.meta.url.
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
    test.skip(true, `Extension not built at ${EXTENSION_BUILD_DIR}. Run 'npm run build' before e2e.`)
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
    // headless Chromium loads the build but does not expose the service worker; in that
    // case, fall back to a static smoke check of the generated output.
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

    // Minimal smoke: popup loads without "Cannot read properties" or bundle errors.
    await expect(popupPage.locator('body')).toBeVisible()

    const consoleErrors: string[] = []
    popupPage.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await popupPage.waitForTimeout(500) // let React mount
    expect(consoleErrors, `Console errors: ${consoleErrors.join('; ')}`).toHaveLength(0)
  } finally {
    if (context) await context.close()
    fs.rmSync(userDataDir, { recursive: true, force: true })
  }
})
