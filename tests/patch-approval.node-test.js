import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
test('manual patch requires the reviewed batch and rejects wrong or stale approval', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-approval-'))
  try {
    const pending = path.join(temporary, '.discipline/patches/pending')
    fs.mkdirSync(pending, { recursive: true })
    const target = path.join(temporary, 'findings.md')
    const original = '# Findings\n\n## Decisions\n- Existing decision\n'
    fs.writeFileSync(target, original)
    const patch = path.join(pending, 'review.md')
    fs.writeFileSync(patch, '# Review\n\nTARGET_FILE: findings.md\nPATCH_MODE: append\nANCHOR: ## Decisions\n\n### CONTENT\n- Approved synthetic decision\n')
    const run = args => spawnSync(process.execPath, [
      path.join(repo, 'node_modules/tsx/dist/cli.mjs'),
      path.join(repo, 'tools/discipline/apply-patch.ts'), '--project-dir', temporary, ...args,
    ], { encoding: 'utf8', cwd: repo })
    const output = result => result.stdout + result.stderr
    assert.equal(run([]).status, 1)
    const preview = run(['--dry-run'])
    assert.equal(preview.status, 0, output(preview))
    assert.match(preview.stdout, /\[OK\]/)
    assert.doesNotMatch(preview.stdout, /\[FAIL\b[^\]\r\n]*\]/)
    const digest = preview.stdout.match(/BATCH_SHA256: ([a-f0-9]{64})/)[1]
    assert.equal(fs.readFileSync(target, 'utf8'), original)
    assert.equal(run(['--approve-sha', '0'.repeat(64)]).status, 1)
    assert.equal(fs.readFileSync(target, 'utf8'), original)
    fs.appendFileSync(patch, '- Changed after review\n')
    assert.equal(run(['--approve-sha', digest]).status, 1)
    assert.equal(fs.readFileSync(target, 'utf8'), original)
    const reviewedAgain = run(['--dry-run'])
    assert.equal(reviewedAgain.status, 0, output(reviewedAgain))
    const newDigest = reviewedAgain.stdout.match(/BATCH_SHA256: ([a-f0-9]{64})/)[1]
    assert.notEqual(newDigest, digest)
    const applied = run(['--approve-sha', newDigest])
    assert.equal(applied.status, 0, output(applied))
    assert.match(fs.readFileSync(target, 'utf8'), /Approved synthetic decision\n- Changed after review/)
    assert.deepEqual(fs.readdirSync(pending), [])
    assert.equal(fs.readdirSync(path.join(temporary, '.discipline/patches/applied')).length, 1)
    const repeat = run(['--approve-sha', newDigest])
    assert.equal(repeat.status, 0, output(repeat))
    assert.equal(fs.readFileSync(target, 'utf8').match(/Approved synthetic decision/g).length, 1)
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true })
  }
})

for (const defect of ['missing file', 'missing anchor']) {
  test(`dry-run exposes ${defect} and approval cannot make the invalid patch applicable`, () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-preview-'))
    try {
      const pending = path.join(temporary, '.discipline/patches/pending')
      fs.mkdirSync(pending, { recursive: true })
      const target = path.join(temporary, 'findings.md')
      const original = '# Findings\n\n## Other section\n- Existing decision\n'
      if (defect === 'missing anchor') fs.writeFileSync(target, original)
      const patch = path.join(pending, 'invalid.md')
      const patchText = '# Review\n\nTARGET_FILE: findings.md\nPATCH_MODE: append\nANCHOR: ## Decisions\n\n### CONTENT\n- Synthetic decision\n'
      fs.writeFileSync(patch, patchText)
      const run = args => spawnSync(process.execPath, [
        path.join(repo, 'node_modules/tsx/dist/cli.mjs'),
        path.join(repo, 'tools/discipline/apply-patch.ts'), '--project-dir', temporary, ...args,
      ], { encoding: 'utf8', cwd: repo })
      const preview = run(['--dry-run'])
      assert.match(preview.stdout, /\[FAIL\b[^\]\r\n]*\]/, preview.stdout + preview.stderr)
      assert.doesNotMatch(preview.stdout, /\[OK\]/)
      const digest = preview.stdout.match(/BATCH_SHA256: ([a-f0-9]{64})/)[1]
      const applied = run(['--approve-sha', digest])
      assert.equal(applied.status, 1, applied.stdout + applied.stderr)
      assert.equal(fs.readFileSync(patch, 'utf8'), patchText)
      if (defect === 'missing anchor') assert.equal(fs.readFileSync(target, 'utf8'), original)
      else assert.equal(fs.existsSync(target), false)
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true })
    }
  })
}
