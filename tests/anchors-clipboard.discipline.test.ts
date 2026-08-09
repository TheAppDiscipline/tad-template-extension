import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Extension runs its tests with vitest (not node:test), so this file
// reimplements in vitest the anchor-NFC, batch-rollback and clipboard assertions
// that tooling.discipline.test.js carries in the other lanes. The files under
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

  // A failed patch must leave the repo exactly as it was found: the batch is all-or-nothing.
  // Regression: the rollback used to be unreachable. The catch block reported the failure with
  // disciplineError(), which calls process.exit(1) on the spot, so the rollback, the writer-lock
  // release and the ledger entry below it never ran. A failing batch left the earlier patches
  // applied, their patch files moved to applied/ (invisible to the next run's pending/ preflight),
  // a stale writer.lock, and no record of the failure.
  it('patch rolls the whole batch back when one patch fails', () => {
    const projectRoot = createPatchProject()
    fs.copyFileSync(path.join(repoRoot, 'findings.md'), path.join(projectRoot, 'findings.md'))
    const pendingDir = path.join(projectRoot, '.discipline', 'patches', 'pending')
    const appliedDir = path.join(projectRoot, '.discipline', 'patches', 'applied')

    // findings.md is patched before progress.md (PATCH_APPLICATION_ORDER), so the valid patch is
    // already written to disk by the time the broken one fails.
    fs.writeFileSync(
      path.join(pendingDir, 'a-valid-findings.md'),
      '# Valid Block\n\nTARGET_FILE: findings.md\nPATCH_MODE: append\nANCHOR: ## Decisions\n\n### CONTENT\n- ROLLBACK_MARKER_MUST_NOT_SURVIVE\n',
      'utf8',
    )
    fs.writeFileSync(
      path.join(pendingDir, 'b-broken-progress.md'),
      '# Broken Block\n\nTARGET_FILE: progress.md\nPATCH_MODE: append\nANCHOR: ## Anchor That Does Not Exist\n\n### CONTENT\nnever applied\n',
      'utf8',
    )
    const findingsBefore = fs.readFileSync(path.join(projectRoot, 'findings.md'), 'utf8')

    const result = runTsx('tools/discipline/apply-patch.ts', ['--project-dir', projectRoot])
    expect(result.status, out(result)).not.toBe(0)
    expect(out(result)).toMatch(/Rollback complete/)

    expect(fs.readFileSync(path.join(projectRoot, 'findings.md'), 'utf8')).toBe(findingsBefore)
    expect(fs.readdirSync(pendingDir).sort()).toEqual(['a-valid-findings.md', 'b-broken-progress.md'])
    expect(fs.readdirSync(appliedDir)).toEqual([])
    expect(fs.existsSync(path.join(projectRoot, '.discipline', 'locks', 'writer.lock'))).toBe(false)

    const ledgerDir = path.join(projectRoot, '.discipline', 'ledger')
    expect(fs.existsSync(ledgerDir), 'a failed batch must still leave a ledger entry').toBe(true)
    const events = fs.readdirSync(ledgerDir)
      .flatMap((f) => fs.readFileSync(path.join(ledgerDir, f), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line))
    const failure = events.find((e) => e.event === 'patch_applied' && e.ok === false)
    expect(failure, 'expected a patch_applied event with ok: false').toBeTruthy()
    expect(failure.count).toBe(0)
    expect(failure.rollback_failures).toBe(0)
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
