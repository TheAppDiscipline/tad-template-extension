import { test, expect, chromium } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const buildDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.output/chrome-mv3')

// The same runtime check is exercised against the shipped build and corrupt copies.
// No static fallback or skip: missing artifacts and registration failures are red.
async function verifyPopup(directory: string, timeout = 10_000) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'))
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${directory}`, `--load-extension=${directory}`],
  })
  try {
    const worker = context.serviceWorkers()[0]
      ?? await context.waitForEvent('serviceworker', { timeout })
    const workerUrl = new URL(worker.url())
    expect(workerUrl.protocol).toBe('chrome-extension:')
    expect(workerUrl.host).toMatch(/^[a-p]{32}$/)
    expect(workerUrl.pathname).toBe(`/${manifest.background.service_worker}`)
    expect(await worker.evaluate(() => location.href)).toBe(worker.url())

    const page = await context.newPage()
    const errors: string[] = []
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    page.on('pageerror', error => errors.push(error.message))
    const popupUrl = `chrome-extension://${workerUrl.host}/${manifest.action.default_popup}`
    await page.goto(popupUrl)
    await expect(page.getByRole('heading', { name: 'Discipline Loop Extension', exact: true })).toBeVisible({ timeout })
    // A round trip through background.ts proves the service handles messages.
    const response = await page.evaluate(async () => {
      const runtime = (globalThis as unknown as {
        chrome: { runtime: { sendMessage(message: unknown): Promise<unknown> } }
      }).chrome.runtime
      const written = await runtime.sendMessage({ type: 'SET_STORAGE', key: 'count', value: 37 })
      const read = await runtime.sendMessage({ type: 'GET_STORAGE', key: 'count' })
      return { written, read }
    })
    expect(response).toEqual({ written: { ok: true }, read: 37 })
    await page.reload()
    await expect(page.getByText('Stored count: 37', { exact: true })).toBeVisible({ timeout })
    expect(errors, 'Popup console errors and uncaught exceptions').toEqual([])
  } finally {
    await context.close()
  }
}

test('compiled extension registers its service and renders the real popup', async () => {
  await verifyPopup(buildDir)
})

test('missing build fails instead of skipping', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'wxt-missing-'))
  try {
    await expect(verifyPopup(temporary)).rejects.toThrow(/ENOENT/)
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true })
  }
})

for (const failure of ['empty-matches', 'missing-worker', 'empty-popup', 'broken-messaging'] as const) {
  test(`runtime smoke rejects ${failure}`, async () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'wxt-negative-'))
    try {
      fs.cpSync(buildDir, temporary, { recursive: true })
      const manifestPath = path.join(temporary, 'manifest.json')
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      if (failure === 'empty-matches') {
        fs.writeFileSync(path.join(temporary, 'invalid-content.js'), 'void 0;')
        manifest.content_scripts = [{ matches: [], js: ['invalid-content.js'] }]
      } else if (failure === 'missing-worker') {
        delete manifest.background
      } else if (failure === 'empty-popup') {
        fs.writeFileSync(path.join(temporary, manifest.action.default_popup), '<html><body></body></html>')
      } else {
        fs.writeFileSync(path.join(temporary, manifest.background.service_worker), 'chrome.runtime.onMessage.addListener(() => false);')
      }
      fs.writeFileSync(manifestPath, JSON.stringify(manifest))
      const expected = failure === 'empty-matches' || failure === 'missing-worker'
        ? /waiting for event "serviceworker"/
        : failure === 'empty-popup' ? /toBeVisible/ : /message port closed|Could not establish connection|toEqual/
      await expect(verifyPopup(temporary, 3_000)).rejects.toThrow(expected)
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true })
    }
  })
}
