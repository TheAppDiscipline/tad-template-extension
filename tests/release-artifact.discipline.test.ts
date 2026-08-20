import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const repoRoot = path.resolve(import.meta.dirname, '..')
const bundleChecker = path.join(repoRoot, 'tools', 'check_bundle_extension.js')
const releaseChecker = path.join(repoRoot, 'tools', 'check_extension_release_ready.js')
const fixtures: string[] = []

afterEach(() => {
  for (const fixture of fixtures.splice(0)) fs.rmSync(fixture, { recursive: true, force: true })
})

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'discipline-extension-release-'))
  fixtures.push(root)
  return root
}

function write(root: string, relative: string, value: string | Buffer) {
  const full = path.join(root, ...relative.split('/'))
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, value)
}

function run(script: string, cwd: string, env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [script], {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  })
}

function pngHeader(size: number) {
  const bytes = Buffer.alloc(32)
  Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes)
  bytes.write('IHDR', 12, 'ascii')
  bytes.writeUInt32BE(size, 16)
  bytes.writeUInt32BE(size, 20)
  bytes.writeUInt32BE(size, 24)
  return bytes
}

function validReleaseFixture(root: string) {
  write(root, 'package.json', '{"name":"focus-meter","version":"1.0.0"}\n')
  const manifest = {
    manifest_version: 3,
    name: 'Focus Meter',
    version: '1.0.0',
    description: 'Track focused browsing sessions.',
    icons: { '16': 'icon/16.png', '48': 'icon/48.png', '128': 'icon/128.png' },
    action: { default_title: 'Focus Meter' },
  }
  write(root, 'entrypoints/content.ts', "export default defineContentScript({ matches: ['https://example.com/*'] })\n")
  for (const size of [16, 48, 128]) {
    const icon = pngHeader(size)
    write(root, `public/icon/${size}.png`, icon)
    for (const target of ['chrome-mv3', 'firefox-mv3']) write(root, `.output/${target}/icon/${size}.png`, icon)
  }
  for (const target of ['chrome-mv3', 'firefox-mv3']) {
    write(root, `.output/${target}/manifest.json`, `${JSON.stringify(manifest)}\n`)
  }
}

describe('extension release artifacts', () => {
  it('fails closed when ZIP artifacts are absent or empty', () => {
    const root = fixture()
    write(root, 'package.json', '{"name":"focus-meter","version":"1.0.0"}\n')
    fs.mkdirSync(path.join(root, '.output'))
    let result = run(bundleChecker, root)
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/Missing current ZIP artifact/)

    write(root, '.output/focus-meter-1.0.0-chrome.zip', Buffer.alloc(0))
    write(root, '.output/focus-meter-1.0.0-firefox.zip', Buffer.from('zip fixture'))
    result = run(bundleChecker, root)
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/empty ZIP artifact/)
  })

  it('rejects a ZIP above the configured project budget', () => {
    const root = fixture()
    write(root, 'package.json', '{"name":"focus-meter","version":"1.0.0"}\n')
    write(root, '.output/focus-meter-1.0.0-chrome.zip', Buffer.alloc(2048, 1))
    write(root, '.output/focus-meter-1.0.0-firefox.zip', Buffer.from('zip fixture'))
    const result = run(bundleChecker, root, { DISCIPLINE_EXTENSION_ZIP_LIMIT_MB: '0.001' })
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/exceeds 0\.001 MB limit/)
  })

  it('accepts release-specific manifests, icons, scope, and non-empty ZIPs', () => {
    const root = fixture()
    validReleaseFixture(root)
    write(root, '.output/focus-meter-1.0.0-chrome.zip', Buffer.from('zip fixture'))
    write(root, '.output/focus-meter-1.0.0-firefox.zip', Buffer.from('zip fixture'))
    expect(run(bundleChecker, root).status).toBe(0)
    expect(run(releaseChecker, root).status).toBe(0)
  })

  it('rejects template identity, empty content scope, and shipped placeholder icons', () => {
    const root = fixture()
    validReleaseFixture(root)
    const templateManifest = {
      manifest_version: 3,
      name: 'Discipline Loop Extension Template',
      version: '1.0.0',
      description: 'Browser extension scaffolded from tad-template-extension',
      icons: { '16': 'icon/16.png', '48': 'icon/48.png', '128': 'icon/128.png' },
    }
    write(root, 'entrypoints/content.ts', 'export default defineContentScript({ matches: [] })\n')
    for (const target of ['chrome-mv3', 'firefox-mv3']) {
      write(root, `.output/${target}/manifest.json`, `${JSON.stringify(templateManifest)}\n`)
    }
    for (const size of [16, 48, 128]) {
      const source = fs.readFileSync(path.join(repoRoot, 'public', 'icon', `${size}.png`))
      expect(createHash('sha256').update(source).digest('hex')).toMatch(/^[a-f0-9]{64}$/)
      write(root, `public/icon/${size}.png`, source)
    }

    const result = run(releaseChecker, root)
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/matches: \[\]/)
    expect(result.stderr).toMatch(/template identity/)
    expect(result.stderr).toMatch(/shipped placeholder/)
  })
})
