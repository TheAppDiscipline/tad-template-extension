import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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

  // The transactional window: the target is written BEFORE the patch file moves to applied/.
  // A failure inside that window (creating applied/, moving the patch) used to escape the
  // rollback, because the journal entry was only pushed after the move succeeded. Replacing
  // applied/ with a regular file makes the mkdir throw at exactly that point.
  it('patch rolls back a failure that happens after the target was written', () => {
    const projectRoot = createPatchProject()
    fs.copyFileSync(path.join(repoRoot, 'findings.md'), path.join(projectRoot, 'findings.md'))
    const appliedDir = path.join(projectRoot, '.discipline', 'patches', 'applied')
    fs.rmSync(appliedDir, { recursive: true, force: true })
    fs.writeFileSync(appliedDir, 'not a directory\n', 'utf8')

    fs.writeFileSync(
      path.join(projectRoot, '.discipline', 'patches', 'pending', 'post-write-failure.md'),
      '# Post Write Failure\n\nTARGET_FILE: findings.md\nPATCH_MODE: append\nANCHOR: ## Decisions\n\n### CONTENT\n- POST_WRITE_MARKER_MUST_NOT_SURVIVE\n',
      'utf8',
    )
    const findingsBefore = fs.readFileSync(path.join(projectRoot, 'findings.md'), 'utf8')

    const result = runTsx('tools/discipline/apply-patch.ts', ['--project-dir', projectRoot])
    expect(result.status, out(result)).not.toBe(0)
    expect(out(result)).toMatch(/Rollback complete/)
    expect(fs.readFileSync(path.join(projectRoot, 'findings.md'), 'utf8')).toBe(findingsBefore)
    expect(fs.readdirSync(path.join(projectRoot, '.discipline', 'patches', 'pending'))).toEqual(['post-write-failure.md'])
  }, 20000)

  // Two patches against the SAME file in one batch, clock frozen so both backups resolve to the
  // identical name. The engine must claim each name atomically and remember the exact path it
  // wrote: one shared backup slot makes the rollback restore an intermediate state.
  it('patch keeps one backup per write when two patches hit the same file on the same millisecond', () => {
    const projectRoot = createPatchProject()
    fs.copyFileSync(path.join(repoRoot, 'findings.md'), path.join(projectRoot, 'findings.md'))
    const pendingDir = path.join(projectRoot, '.discipline', 'patches', 'pending')
    fs.writeFileSync(path.join(pendingDir, 'a-first-decisions.md'),
      '# First\n\nTARGET_FILE: findings.md\nPATCH_MODE: append\nANCHOR: ## Decisions\n\n### CONTENT\n- FIRST_MARKER_MUST_NOT_SURVIVE\n', 'utf8')
    fs.writeFileSync(path.join(pendingDir, 'b-second-risks.md'),
      '# Second\n\nTARGET_FILE: findings.md\nPATCH_MODE: append\nANCHOR: ## Risks\n\n### CONTENT\n- SECOND_MARKER_MUST_NOT_SURVIVE\n', 'utf8')
    fs.writeFileSync(path.join(pendingDir, 'c-broken-progress.md'),
      '# Broken\n\nTARGET_FILE: progress.md\nPATCH_MODE: append\nANCHOR: ## Anchor That Does Not Exist\n\n### CONTENT\nnever applied\n', 'utf8')
    const findingsBefore = fs.readFileSync(path.join(projectRoot, 'findings.md'), 'utf8')

    const script = path.join(projectRoot, 'frozen-clock-apply.mjs')
    fs.writeFileSync(
      script,
      `// Freeze the clock so every backup in the batch wants the same base name.
Date.now = () => 1780000000000
const { applyPatches } = await import('${pathToFileURL(path.join(repoRoot, 'tools', 'discipline', 'apply-patch.ts')).href}')
try { await applyPatches(${JSON.stringify(projectRoot)}) } catch (err) { console.log('FAILED:' + err.message) }
`,
      'utf8',
    )
    const result = runTsx(script)
    expect(out(result)).toMatch(/FAILED:Patch failed/)

    const findingsAfter = fs.readFileSync(path.join(projectRoot, 'findings.md'), 'utf8')
    expect(findingsAfter).toBe(findingsBefore)
    expect(findingsAfter.includes('FIRST_MARKER_MUST_NOT_SURVIVE'), 'the first patch must be undone too').toBe(false)
    const backups = fs.readdirSync(path.join(projectRoot, '.discipline', 'backups')).filter((f) => f.startsWith('findings.md.'))
    expect(backups.length, `expected 2 distinct backups, got ${backups.join(', ')}`).toBe(2)
  }, 20000)

  // Ported from the dogfood app: replace_section keeps the anchor line and splices CONTENT after
  // it, so a CONTENT block that repeats the heading writes it twice and every later patch to that
  // section then fails with "Duplicate anchor". replace_block replaces the anchor line itself, so
  // there the repeated heading is the one that must survive.
  it('patch replace_section drops, and replace_block keeps, a CONTENT block that repeats the anchor', () => {
    const headingCount = (md: string) => md.split('\n').filter((l) => l.trim() === '## Local Section').length

    const section = createPatchProject()
    fs.appendFileSync(path.join(section, 'progress.md'), '\n## Local Section\n\n- old content\n', 'utf8')
    fs.writeFileSync(
      path.join(section, '.discipline', 'patches', 'pending', 'dup-in-content.md'),
      '# Repeated Anchor\n\nTARGET_FILE: progress.md\nPATCH_MODE: replace_section\nANCHOR: ## Local Section\n\n### CONTENT\n## Local Section\nSECTION_NO_DUPLICATE_HEADING\n',
      'utf8',
    )
    const sectionResult = runTsx('tools/discipline/apply-patch.ts', ['--project-dir', section])
    expect(sectionResult.status, out(sectionResult)).toBe(0)
    expect(out(sectionResult)).toMatch(/CONTENT repeated the anchor/)
    const sectionMd = fs.readFileSync(path.join(section, 'progress.md'), 'utf8')
    expect(sectionMd).toMatch(/SECTION_NO_DUPLICATE_HEADING/)
    expect(headingCount(sectionMd), 'the anchor heading must appear exactly once').toBe(1)

    const block = createPatchProject()
    fs.appendFileSync(path.join(block, 'progress.md'), '\n## Local Section\n\n- old content\n', 'utf8')
    fs.writeFileSync(
      path.join(block, '.discipline', 'patches', 'pending', 'block-keeps-anchor.md'),
      '# Block Keeps Anchor\n\nTARGET_FILE: progress.md\nPATCH_MODE: replace_block\nANCHOR: ## Local Section\n\n### CONTENT\n## Local Section\nBLOCK_KEEPS_HEADING\n',
      'utf8',
    )
    const blockResult = runTsx('tools/discipline/apply-patch.ts', ['--project-dir', block])
    expect(blockResult.status, out(blockResult)).toBe(0)
    expect(out(blockResult)).not.toMatch(/CONTENT repeated the anchor/)
    const blockMd = fs.readFileSync(path.join(block, 'progress.md'), 'utf8')
    expect(blockMd).toMatch(/BLOCK_KEEPS_HEADING/)
    expect(headingCount(blockMd), 'the anchor heading must survive exactly once').toBe(1)
  }, 20000)

  // The rollback's own failure path: with the restore forced to fail the batch really is
  // half-patched, and `count` must be the number of state files left carrying a patch.
  it('patch reports an incomplete rollback and counts only the files left modified', () => {
    const projectRoot = createPatchProject()
    fs.copyFileSync(path.join(repoRoot, 'findings.md'), path.join(projectRoot, 'findings.md'))
    const pendingDir = path.join(projectRoot, '.discipline', 'patches', 'pending')
    fs.writeFileSync(path.join(pendingDir, 'a-valid-findings.md'),
      '# Valid\n\nTARGET_FILE: findings.md\nPATCH_MODE: append\nANCHOR: ## Decisions\n\n### CONTENT\n- ROLLBACK_FAILURE_MARKER\n', 'utf8')
    fs.writeFileSync(path.join(pendingDir, 'b-broken-progress.md'),
      '# Broken\n\nTARGET_FILE: progress.md\nPATCH_MODE: append\nANCHOR: ## Anchor That Does Not Exist\n\n### CONTENT\nnever applied\n', 'utf8')

    const script = path.join(projectRoot, 'failing-rollback.mjs')
    fs.writeFileSync(
      script,
      `import fs from 'node:fs'
import { applyPatches } from '${pathToFileURL(path.join(repoRoot, 'tools', 'discipline', 'apply-patch.ts')).href}'
const ops = {
  existsSync: (p) => fs.existsSync(p),
  copyFileSync: (src, dest) => {
    if (dest.endsWith('findings.md')) throw new Error('EPERM: simulated read-only target')
    fs.copyFileSync(src, dest)
  },
  renameSync: (src, dest) => { fs.renameSync(src, dest) },
}
try { await applyPatches(${JSON.stringify(projectRoot)}, false, ops) } catch (err) { console.log('FAILED:' + err.message) }
`,
      'utf8',
    )
    const output = out(runTsx(script))
    expect(output).toMatch(/Rollback incomplete: 1 of 1 state file\(s\) could not be restored/)
    expect(fs.readFileSync(path.join(projectRoot, 'findings.md'), 'utf8')).toMatch(/ROLLBACK_FAILURE_MARKER/)

    const ledgerDir = path.join(projectRoot, '.discipline', 'ledger')
    const events = fs.readdirSync(ledgerDir)
      .flatMap((f) => fs.readFileSync(path.join(ledgerDir, f), 'utf8').trim().split('\n'))
      .filter(Boolean)
      .map((line) => JSON.parse(line))
    const failure = events.find((e) => e.event === 'patch_applied' && e.ok === false)
    expect(failure.count, 'count = state files left carrying a patch').toBe(1)
    expect(failure.rollback_failures).toBe(1)
    expect(failure.stranded_patches).toBe(0)
  }, 20000)

  // applyPatches is imported by run.ts and watch.ts. If it exits the process on failure, their
  // finally blocks never run (the slice lease in run.ts). The core must reject; only the CLI
  // entrypoint decides an exit code.
  it('applyPatches rejects instead of killing the importing process', () => {
    const projectRoot = createPatchProject()
    fs.writeFileSync(
      path.join(projectRoot, '.discipline', 'patches', 'pending', 'broken-for-import.md'),
      '# Broken For Import\n\nTARGET_FILE: progress.md\nPATCH_MODE: append\nANCHOR: ## Anchor That Does Not Exist\n\n### CONTENT\nnever applied\n',
      'utf8',
    )
    const marker = path.join(projectRoot, 'finally-ran.txt')
    const script = path.join(projectRoot, 'import-apply.mjs')
    fs.writeFileSync(
      script,
      `import fs from 'node:fs'
import { applyPatches, PatchBatchError } from '${pathToFileURL(path.join(repoRoot, 'tools', 'discipline', 'apply-patch.ts')).href}'
let code = 0
try {
  await applyPatches(${JSON.stringify(projectRoot)})
  code = 99
} catch (err) {
  console.log('CAUGHT:' + (err instanceof PatchBatchError ? 'PatchBatchError' : err?.constructor?.name))
  code = 7
} finally {
  fs.writeFileSync(${JSON.stringify(marker)}, 'finally ran\\n', 'utf8')
}
process.exit(code)
`,
      'utf8',
    )
    const result = runTsx(script)
    expect(result.status, out(result)).toBe(7)
    expect(fs.existsSync(marker), 'the importing process must reach its own finally block').toBe(true)
    expect(out(result)).toMatch(/CAUGHT:PatchBatchError/)
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
