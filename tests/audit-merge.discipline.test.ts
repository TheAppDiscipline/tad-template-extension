import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Extension corre con vitest; este archivo reimplementa en vitest los mismos casos
// que tooling.discipline.test.js valida en los otros lanes para audit-merge.ts.
// audit-merge.ts es byte-identico en los 4 templates.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const tsxCli = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs')

function runMerge(args: string[] = []) {
  return spawnSync(process.execPath, [tsxCli, 'tools/discipline/audit-merge.ts', ...args], {
    cwd: repoRoot,
    env: process.env,
    encoding: 'utf8',
  })
}

function out(r: ReturnType<typeof runMerge>): string {
  return `${r.stdout}${r.stderr}`
}

function writeRawAudit(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'discipline-audit-raw-'))
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content, 'utf8')
  }
  return dir
}

function envelope(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schema_version: 'discipline.agent_audit.v1',
    agent: 'discipline-rls-auditor',
    status: 'PASS',
    blocking: false,
    findings: [],
    summary: 'ok',
    ...overrides,
  })
}

describe('audit-merge (paso determinista del fan-out 7.2)', () => {
  it('fusiona envelopes validos y computa global PASS (exit 0)', () => {
    const dir = writeRawAudit({
      'a.json': envelope({ agent: 'discipline-rls-auditor', status: 'PASS' }),
      'b.json': envelope({ agent: 'discipline-a11y-checker', status: 'PASS' }),
    })
    const outFile = path.join(dir, 'report.json')
    const r = runMerge(['--raw-dir', dir, '--out', outFile])
    expect(r.status, out(r)).toBe(0)
    expect(fs.existsSync(outFile)).toBe(true)
    const report = JSON.parse(fs.readFileSync(outFile, 'utf8'))
    expect(report.global_status).toBe('PASS')
    expect(report.blocking).toBe(false)
    expect(report.agents.length).toBe(2)
  })

  it('global FAIL si algun agente FAIL; advisory (exit 0) salvo --strict (exit 1)', () => {
    const failFinding = { severity: 'critical', rule: 'NN 17.3', location: 'm.sql:1', detail: 'x', fix: null }
    const dir = writeRawAudit({
      'a.json': envelope({ status: 'PASS' }),
      'b.json': envelope({ agent: 'discipline-security-reviewer', status: 'FAIL', findings: [failFinding], summary: '1 critical' }),
    })
    const outFile = path.join(path.dirname(dir), path.basename(dir) + '-report.json')
    const advisory = runMerge(['--raw-dir', dir, '--out', outFile])
    expect(advisory.status, out(advisory)).toBe(0)
    expect(JSON.parse(fs.readFileSync(outFile, 'utf8')).global_status).toBe('FAIL')
    const strict = runMerge(['--raw-dir', dir, '--out', outFile, '--strict'])
    expect(strict.status, out(strict)).toBe(1)
  })

  it('WARN si hay moderate pero ningun FAIL', () => {
    const mod = { severity: 'moderate', rule: 'scope-creep', location: 'x.ts', detail: 'd', fix: 'f' }
    const dir = writeRawAudit({
      'a.json': envelope({ status: 'PASS' }),
      'b.json': envelope({ agent: 'discipline-scope-guard', status: 'WARN', findings: [mod], summary: '1 moderate' }),
    })
    const outFile = path.join(dir, 'r.json')
    const r = runMerge(['--raw-dir', dir, '--out', outFile])
    expect(r.status, out(r)).toBe(0)
    const report = JSON.parse(fs.readFileSync(outFile, 'utf8'))
    expect(report.global_status).toBe('WARN')
    expect(report.counts.moderate).toBe(1)
  })

  it('envelope fuera de schema falla claro (exit 2), no fusiona', () => {
    const dir = writeRawAudit({
      'a.json': envelope({ status: 'PASS' }),
      'bad.json': envelope({ status: 'BROKEN' }),
    })
    const r = runMerge(['--raw-dir', dir, '--out', path.join(dir, 'r.json')])
    expect(r.status, out(r)).toBe(2)
    expect(out(r)).toMatch(/contrato|agent_audit\.v1|invalido/i)
  })

  it('strippea fences ```json defensivamente', () => {
    const fenced = '```json\n' + envelope({ status: 'PASS' }) + '\n```'
    const dir = writeRawAudit({ 'a.json': fenced })
    const outFile = path.join(dir, 'r.json')
    const r = runMerge(['--raw-dir', dir, '--out', outFile])
    expect(r.status, out(r)).toBe(0)
    expect(JSON.parse(fs.readFileSync(outFile, 'utf8')).global_status).toBe('PASS')
  })

  it('acepta location y fix nulos', () => {
    const finding = { severity: 'critical', rule: 'legal-docs-present', location: null, detail: 'no privacy policy', fix: null }
    const dir = writeRawAudit({
      'a.json': envelope({ agent: 'discipline-legal-product-auditor', status: 'FAIL', findings: [finding], summary: '1 critical' }),
    })
    const outFile = path.join(dir, 'r.json')
    const r = runMerge(['--raw-dir', dir, '--out', outFile])
    expect(r.status, out(r)).toBe(0)
    const report = JSON.parse(fs.readFileSync(outFile, 'utf8'))
    expect(report.findings[0].location).toBe(null)
    expect(report.findings[0].fix).toBe(null)
  })

  it('sin --raw-dir o carpeta vacia falla claro (exit 2)', () => {
    const noArg = runMerge([])
    expect(noArg.status, out(noArg)).toBe(2)
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'discipline-audit-empty-'))
    const empty = runMerge(['--raw-dir', emptyDir])
    expect(empty.status, out(empty)).toBe(2)
  })

  it('--expected completo → PASS, missing_agents vacio', () => {
    const dir = writeRawAudit({
      'a.json': envelope({ agent: 'discipline-scope-guard', status: 'PASS' }),
      'b.json': envelope({ agent: 'discipline-security-reviewer', status: 'PASS' }),
    })
    const outFile = path.join(path.dirname(dir), path.basename(dir) + '-rep.json')
    const r = runMerge(['--raw-dir', dir, '--out', outFile, '--expected', 'discipline-scope-guard,discipline-security-reviewer'])
    expect(r.status, out(r)).toBe(0)
    const report = JSON.parse(fs.readFileSync(outFile, 'utf8'))
    expect(report.global_status).toBe('PASS')
    expect(report.missing_agents).toEqual([])
  })

  it('--expected faltante → WARN + missing_agents (advisory exit 0)', () => {
    const dir = writeRawAudit({
      'a.json': envelope({ agent: 'discipline-scope-guard', status: 'PASS' }),
    })
    const outFile = path.join(path.dirname(dir), path.basename(dir) + '-rep.json')
    const r = runMerge(['--raw-dir', dir, '--out', outFile, '--expected', 'discipline-scope-guard,discipline-security-reviewer'])
    expect(r.status, out(r)).toBe(0)
    const report = JSON.parse(fs.readFileSync(outFile, 'utf8'))
    expect(report.global_status).toBe('WARN')
    expect(report.missing_agents).toEqual(['discipline-security-reviewer'])
  })

  it('--expected faltante + --strict → exit no-cero', () => {
    const dir = writeRawAudit({
      'a.json': envelope({ agent: 'discipline-scope-guard', status: 'PASS' }),
    })
    const outFile = path.join(path.dirname(dir), path.basename(dir) + '-rep.json')
    const r = runMerge(['--raw-dir', dir, '--out', outFile, '--expected', 'discipline-scope-guard,discipline-security-reviewer', '--strict'])
    expect(r.status, out(r)).not.toBe(0)
  })
})
