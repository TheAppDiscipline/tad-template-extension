import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Extension corre sus tests con vitest (no node:test), por eso este archivo
// reimplementa en vitest las mismas aserciones que tooling.discipline.test.js
// usa en los otros lanes. cli.ts es byte-identico en los 4 templates; este test
// protege la copia de extension contra drift y verifica el wiring del lane.

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

describe('discipline CLI (capa determinista + seam LLM)', () => {
  it('help (sin args) sale 0 y describe las dos capas', () => {
    const r = runCli([])
    expect(r.status, out(r)).toBe(0)
    expect(out(r)).toMatch(/Capa determinista/)
    expect(out(r)).toMatch(/AUN NO IMPLEMENTADA/)
  })

  it('comando desconocido falla claro (exit != 0)', () => {
    const r = runCli(['frobnicate'])
    expect(r.status, out(r)).not.toBe(0)
    expect(out(r)).toMatch(/desconocido/)
  })

  it('--with-llm aun no implementado: exit 2 y mensaje claro', () => {
    const r = runCli(['step1', '--with-llm'])
    expect(r.status, out(r)).toBe(2)
    expect(out(r)).toMatch(/not implemented/i)
  })

  it('dispatch real corre un script existente y propaga exit 0', () => {
    // `status` es un dashboard read-only: sale 0 sin importar el PROFILE (a diferencia de
    // `doctor`, que sale 1 en PROFILE=LAUNCH/PROD sin scorecard). Prueba que el wrapper
    // despacha a un npm script y propaga su exit, no solo help/error.
    const r = runCli(['status'])
    expect(r.status, out(r)).toBe(0)
    expect(out(r)).toMatch(/Discipline/i)
  }, 20000)

  it('--provider sin --with-llm falla claro (exit 1), no descarta el flag en silencio', () => {
    const r = runCli(['step1', '--provider', 'claude'])
    expect(r.status, out(r)).toBe(1)
    expect(out(r)).toMatch(/--provider solo aplica con --with-llm/)
  })
})
