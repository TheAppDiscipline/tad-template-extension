import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Extension runs its tests with vitest (not node:test), so this file
// reimplements in vitest the anchor-NFC and clipboard assertions that
// tooling.discipline.test.js carries in the other lanes. The files under
// tools/discipline are byte-identical across the 4 templates.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const tsxCli = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs')

function runTsx(script: string, args: string[] = []) {
  return spawnSync(process.execPath, [tsxCli, script, ...args], {
    cwd: repoRoot,
    env: process.env,
    encoding: 'utf8',
  })
}

function out(r: ReturnType<typeof runTsx>): string {
  return `${r.stdout}${r.stderr}`
}

function createPatchProject(): string {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'discipline-anchors-'))
  fs.copyFileSync(path.join(repoRoot, 'progress.md'), path.join(projectRoot, 'progress.md'))
  fs.mkdirSync(path.join(projectRoot, '.discipline', 'patches', 'pending'), { recursive: true })
  fs.mkdirSync(path.join(projectRoot, '.discipline', 'patches', 'applied'), { recursive: true })
  return projectRoot
}

describe('anchor NFC normalization + clipboard command (parity with the other lanes)', () => {
  it('patch matches an NFD heading against its NFC anchor', () => {
    const projectRoot = createPatchProject()
    const progressPath = path.join(projectRoot, 'progress.md')
    // "## Sección Local" with the ó decomposed as o + U+0301 (NFD, how macOS tools often emit it)
    fs.appendFileSync(progressPath, '\n## Seccio\u0301n Local\n\n- old content\n', 'utf8')

    // Same heading precomposed (NFC, ó) in the patch anchor
    fs.writeFileSync(
      path.join(projectRoot, '.discipline', 'patches', 'pending', 'nfc-anchor.md'),
      '## nfc_anchor_patch\n\nTARGET_FILE: progress.md\nPATCH_MODE: replace_section\nANCHOR: ## Secci\u00F3n Local\n\n### CONTENT\n- replaced via NFC-normalized anchor\n',
      'utf8',
    )

    const result = runTsx('tools/discipline/apply-patch.ts', ['--project-dir', projectRoot])
    expect(result.status, out(result)).toBe(0)
    expect(fs.readFileSync(progressPath, 'utf8')).toMatch(/replaced via NFC-normalized anchor/)
  }, 20000)

  it('patch flags NFC/NFD twin headings as duplicate anchors', () => {
    const projectRoot = createPatchProject()
    const progressPath = path.join(projectRoot, 'progress.md')
    // One NFC twin and one NFD twin: the same rendered heading twice
    fs.appendFileSync(progressPath, '\n## Secci\u00F3n Local\n\n- nfc twin\n\n## Seccio\u0301n Local\n\n- nfd twin\n', 'utf8')

    fs.writeFileSync(
      path.join(projectRoot, '.discipline', 'patches', 'pending', 'dup-anchor.md'),
      '## dup_anchor_patch\n\nTARGET_FILE: progress.md\nPATCH_MODE: append\nANCHOR: ## Secci\u00F3n Local\n\n### CONTENT\n- must not apply\n',
      'utf8',
    )

    const result = runTsx('tools/discipline/apply-patch.ts', ['--project-dir', projectRoot])
    expect(result.status, out(result)).not.toBe(0)
    expect(out(result)).toMatch(/Duplicate anchor/)
    expect(fs.readFileSync(progressPath, 'utf8')).not.toMatch(/must not apply/)
  }, 20000)

  it('clipboard on win32 routes through PowerShell Set-Clipboard reading the temp file as UTF-8', () => {
    const result = runTsx('tools/discipline/lib/clipboard.ts', ['--print-command', 'win32'])
    expect(result.status, out(result)).toBe(0)
    const command = JSON.parse(result.stdout)
    expect(command.file).toBe('powershell.exe')
    const psCommand = command.args[command.args.length - 1]
    expect(psCommand).toMatch(/Set-Clipboard/)
    expect(psCommand).toMatch(/-Encoding UTF8/)
  }, 20000)

  it('discipline tooling never shells out to clip.exe (OEM codepage corrupts UTF-8 accents)', () => {
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (entry.name.endsWith('.ts') && /['"`]clip['"`]/.test(fs.readFileSync(full, 'utf8'))) offenders.push(entry.name)
      }
    }
    walk(path.join(repoRoot, 'tools', 'discipline'))
    expect(offenders).toEqual([])
  })
})
