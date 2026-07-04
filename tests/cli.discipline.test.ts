import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Extension runs its tests with vitest (not node:test), so this file
// reimplements in vitest the same assertions that tooling.discipline.test.js
// uses in the other lanes. cli.ts is byte-identical across the 4 templates; this test
// protects the extension copy against drift and verifies the lane wiring.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const tsxCli = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs')

function runCli(args: string[] = []) {
  return spawnSync(process.execPath, [tsxCli, 'tools/discipline/cli.ts', ...args], {
    cwd: repoRoot,
    env: process.env,
    encoding: 'utf8',
  })
}

function out(r: ReturnType<typeof runCli>): string {
  return `${r.stdout}${r.stderr}`
}

describe('discipline CLI (deterministic layer + LLM seam)', () => {
  it('help (without args) exits 0 and describes both layers', () => {
    const r = runCli([])
    expect(r.status, out(r)).toBe(0)
    expect(out(r)).toMatch(/Deterministic layer/)
    expect(out(r)).toMatch(/NOT IMPLEMENTED YET/)
  })

  it('unknown command fails clearly (exit != 0)', () => {
    const r = runCli(['frobnicate'])
    expect(r.status, out(r)).not.toBe(0)
    expect(out(r)).toMatch(/unknown command/)
  })

  it('--with-llm is not implemented yet: exit 2 with a clear message', () => {
    const r = runCli(['step1', '--with-llm'])
    expect(r.status, out(r)).toBe(2)
    expect(out(r)).toMatch(/not implemented/i)
  })

  it('real dispatch runs an existing script and propagates exit 0', () => {
    // `status` is a read-only dashboard: it exits 0 regardless of PROFILE (unlike
    // `doctor`, which exits 1 in PROFILE=LAUNCH/PROD without a scorecard). Proves the wrapper
    // dispatches to an npm script and propagates its exit, not only help/error.
    const r = runCli(['status'])
    expect(r.status, out(r)).toBe(0)
    expect(out(r)).toMatch(/Discipline/i)
  }, 20000)

  it('--provider without --with-llm fails clearly (exit 1), does not silently drop the flag', () => {
    const r = runCli(['step1', '--provider', 'claude'])
    expect(r.status, out(r)).toBe(1)
    expect(out(r)).toMatch(/--provider only applies with --with-llm/)
  })
})
