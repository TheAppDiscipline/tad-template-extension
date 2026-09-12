import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { evaluateAudit } from '../tools/check_audit.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const levels = ['info', 'low', 'moderate', 'high', 'critical']
function report(severity) {
  const vulnerabilities = severity ? {
    example: { name: 'example', severity, via: [{
      source: 1, name: 'example', dependency: 'example', title: 'synthetic advisory',
      url: 'https://example.invalid/advisory', severity, range: '*',
      cvss: { score: null, vectorString: null }, cwe: [],
    }], nodes: ['node_modules/example'] },
  } : {}
  return {
    auditReportVersion: 2, vulnerabilities,
    metadata: {
      vulnerabilities: Object.fromEntries([...levels.map(level => [level, Number(level === severity)]), ['total', Number(!!severity)]]),
      dependencies: { prod: 2, dev: 0, optional: 0, peer: 0, peerOptional: 0, total: 1 },
    },
  }
}
const result = (body, status = 0) => ({ stdout: JSON.stringify(body), status, stderr: '', signal: null })
function dependencyResult(dependencies) {
  const body = report()
  body.metadata.dependencies = dependencies
  return result(body)
}

const dependencyCounts = overrides => ({
  prod: 0, dev: 0, optional: 0, peer: 0, peerOptional: 0, total: 10, ...overrides,
})
const inventoryNegativeCases = [
  ['dependency inventory uncovered', dependencyCounts({})],
  ['dependency inventory production overlap', dependencyCounts({ prod: 11, dev: 11 })],
  ['dependency inventory missing root', dependencyCounts({ total: 0 })],
  ['dependency inventory coverage short by one', dependencyCounts({ prod: 10 })],
  ['dependency inventory dev overlap by one', dependencyCounts({ prod: 10, dev: 2 })],
  ['dependency inventory optional overlap by one', dependencyCounts({ prod: 10, optional: 2 })],
  ['dependency inventory peer overlap by one', dependencyCounts({ prod: 10, peer: 2 })],
  ['dependency inventory peerOptional overlap by one', dependencyCounts({ prod: 10, peerOptional: 2 })],
  ['dependency inventory overlap above safe sum', dependencyCounts({ prod: Number.MAX_SAFE_INTEGER, dev: 2, total: Number.MAX_SAFE_INTEGER })],
  ['dependency inventory former buyer fixture', dependencyCounts({ prod: 1, total: 1 })],
  ['dependency inventory former Internal fixture', dependencyCounts({ prod: 3, total: 3 })],
]
const inventoryPositiveCases = [
  ['all production boundary', dependencyCounts({ prod: 11 })],
  ['production and dev boundary', dependencyCounts({ prod: 10, dev: 1 })],
  ['disjoint nonproduction categories', dependencyCounts({ prod: 1, dev: 5, optional: 5 })],
  ['all nonproduction categories overlap', dependencyCounts({ prod: 1, dev: 10, optional: 10, peer: 10, peerOptional: 10 })],
  ['exact inventory above safe sum', dependencyCounts({ prod: Number.MAX_SAFE_INTEGER, dev: 1, total: Number.MAX_SAFE_INTEGER })],
  ['large overlapping categories', dependencyCounts({ prod: 1, dev: Number.MAX_SAFE_INTEGER, optional: Number.MAX_SAFE_INTEGER, peer: Number.MAX_SAFE_INTEGER, peerOptional: Number.MAX_SAFE_INTEGER, total: Number.MAX_SAFE_INTEGER })],
]
function changed(change, severity = 'low') {
  const body = report(severity)
  change(body)
  return result(body, Number(severity === 'high' || severity === 'critical'))
}
for (const severity of [undefined, ...levels]) {
  test(`audit accepts demonstrated ${severity ?? 'zero'} result at the configured threshold`, () => {
    const blocked = severity === 'high' || severity === 'critical'
    const verdict = evaluateAudit(result(report(severity), Number(blocked)))
    assert.equal(verdict.code, Number(blocked))
    assert.match(verdict.message, blocked ? /\[FAIL\]/ : /\[PASS\]/)
    const cli = runAuditCli(result(report(severity), Number(blocked)))
    assert.equal(cli.status, Number(blocked), cli.stdout + cli.stderr)
    assert.doesNotMatch(cli.stdout, /could not be verified/)
  })
}
const negatives = [
  ...inventoryNegativeCases.map(([name, dependencies]) => [name, dependencyResult(dependencies)]),
  ['critical nested advisory hidden as low', changed(r => { r.vulnerabilities.example.via[0].severity = 'critical'; r.vulnerabilities.example.via[0].cvss.score = 9.8 })],
  ['null via and nodes', changed(r => { r.vulnerabilities.example.via = [null]; r.vulnerabilities.example.nodes = [null] })],
  ['impossible dependency count', changed(r => { r.metadata.dependencies.prod = 10; r.metadata.dependencies.total = 0 }, undefined)],
  ['null via', changed(r => { r.vulnerabilities.example.via = [null] })],
  ['primitive via', changed(r => { r.vulnerabilities.example.via = [42] })],
  ['empty via reference', changed(r => { r.vulnerabilities.example.via = [''] })],
  ['missing via reference', changed(r => { r.vulnerabilities.example.via = ['missing'] })],
  ['incomplete advisory object', changed(r => { r.vulnerabilities.example.via = [{}] })],
  ['unknown advisory severity', changed(r => { r.vulnerabilities.example.via[0].severity = 'unknown' })],
  ['overstated direct severity', changed(r => { r.vulnerabilities.example.via[0].severity = 'info' })],
  ['invalid advisory identity', changed(r => { r.vulnerabilities.example.via[0].source = null })],
  ['invalid cvss', changed(r => { r.vulnerabilities.example.via[0].cvss.score = 11 })],
  ['null node', changed(r => { r.vulnerabilities.example.nodes = [null] })],
  ['non-string node', changed(r => { r.vulnerabilities.example.nodes = [42] })],
  ['empty node', changed(r => { r.vulnerabilities.example.nodes = [''] })],
  ['duplicate node', changed(r => { r.vulnerabilities.example.nodes.push(r.vulnerabilities.example.nodes[0]) })],
  ['mismatched package key', changed(r => { r.vulnerabilities.example.name = 'other' })],
  ['impossible overlapping category', changed(r => { r.metadata.dependencies.optional = 10 })],
  ['network error', result({ error: { code: 'ECONNREFUSED', summary: 'SYNTHETIC_SECRET registry failure' } }, 1)],
  ['authentication error', result({ error: { code: 'E401', detail: 'SYNTHETIC_SECRET' } }, 1)],
  ['invalid JSON', { stdout: 'SYNTHETIC_SECRET not JSON', status: 1 }],
  ['empty JSON', result({})],
  ['missing metadata', result({ auditReportVersion: 2, vulnerabilities: {} })],
  ['spawn failure', { ...result(report()), error: new Error('SYNTHETIC_SECRET') }],
  ['signal', { ...result(report()), signal: 'SIGTERM' }],
  ['unknown exit', result(report(), 2)],
  ['failed query with clean report', result(report(), 1)],
  ['success with high findings', result(report('high'), 0)],
  ['missing severity', (() => { const r = report(); delete r.metadata.vulnerabilities.high; return result(r) })()],
  ['invalid count', (() => { const r = report(); r.metadata.vulnerabilities.high = -1; return result(r) })()],
  ['contradictory total', (() => { const r = report(); r.metadata.vulnerabilities.total = 1; return result(r) })()],
  ['hidden high finding', (() => { const r = report('high'); r.metadata.vulnerabilities.high = 0; r.metadata.vulnerabilities.total = 0; return result(r) })()],
  ['missing dependency data', (() => { const r = report(); delete r.metadata.dependencies; return result(r) })()],
  ['incomplete advisory', (() => { const r = report('high'); r.vulnerabilities.example.via = []; return result(r, 1) })()],
]
for (const [name, fixture] of negatives) {
  test(`audit fails closed on ${name} without exposing registry output`, () => {
    const verdict = evaluateAudit(fixture)
    assert.equal(verdict.code, 1)
    assert.match(verdict.message, /could not be verified/)
    assert.doesNotMatch(verdict.message, /PASS|SKIP|SYNTHETIC_SECRET/)
    const cli = runAuditCli(fixture)
    assert.equal(cli.status, 1, cli.stdout + cli.stderr)
    assert.match(cli.stdout, /could not be verified/)
    assert.doesNotMatch(cli.stdout + cli.stderr, /PASS|SKIP|SYNTHETIC_SECRET/)
  })
}

test('audit accepts inventory boundaries without equating category sums', () => {
  for (const [name, dependencies] of inventoryPositiveCases) {
    const fixture = dependencyResult(dependencies)
    assert.equal(evaluateAudit(fixture).code, 0, name)
    const cli = runAuditCli(fixture)
    assert.equal(cli.status, 0, name + ': ' + cli.stdout + cli.stderr)
    assert.doesNotMatch(cli.stdout, /could not be verified/)
  }
})

test('audit accepts the npm root count and overlapping dependency categories', () => {
  for (const dependencies of [
    { prod: 1, dev: 0, optional: 0, peer: 0, peerOptional: 0, total: 0 },
    { prod: 1, dev: 2, optional: 2, peer: 2, peerOptional: 1, total: 2 },
  ]) {
    const body = report()
    body.metadata.dependencies = dependencies
    assert.equal(evaluateAudit(result(body)).code, 0)
    assert.equal(runAuditCli(result(body)).status, 0)
  }
})

test('audit accepts multiple advisories and named metavulnerability links', () => {
  const body = report('moderate')
  body.vulnerabilities.example.via.push({ ...body.vulnerabilities.example.via[0], source: 2, severity: 'low' })
  body.vulnerabilities.parent = { name: 'parent', severity: 'low', via: ['example'], nodes: ['node_modules/parent'] }
  body.metadata.vulnerabilities.low = 1
  body.metadata.vulnerabilities.total = 2
  body.metadata.dependencies.prod = 3
  body.metadata.dependencies.total = 2
  assert.equal(evaluateAudit(result(body)).code, 0)
  assert.equal(runAuditCli(result(body)).status, 0)
})

function runAuditCli(fixture) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-cli-'))
  try {
    const mock = path.join(temporary, 'audit-query.cjs')
    fs.writeFileSync(mock, `const cp = require('node:child_process');
const real = cp.spawnSync;
cp.spawnSync = function(command, args, options) {
  if (Array.isArray(args) && args[0] === 'audit') return ${JSON.stringify(fixture)};
  return real(command, args, options);
};
`)
    return spawnSync(process.execPath, ['--require', mock, path.join(root, 'tools/check_audit.js')], {
      encoding: 'utf8', windowsHide: true, timeout: 15_000,
    })
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true })
  }
}

test('launch command propagates a deterministic npm audit failure', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-launch-'))
  try {
    const original = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
    assert.equal(original.scripts['audit:high'], 'node tools/check_audit.js')
    assert.match(original.scripts['gate:launch'], /&& npm run audit:high$/)
    // Execute the real launch chain in isolation. Unrelated gates are green fixtures.
    const scripts = Object.fromEntries(Object.keys(original.scripts).map(name => [name, 'node -e "process.exit(0)"']))
    scripts['audit:high'] = original.scripts['audit:high']
    scripts['gate:launch'] = original.scripts['gate:launch']
    fs.mkdirSync(path.join(temporary, 'tools'))
    fs.copyFileSync(path.join(root, 'tools/check_audit.js'), path.join(temporary, 'tools/check_audit.js'))
    fs.writeFileSync(path.join(temporary, 'package.json'), JSON.stringify({ type: 'module', scripts }))
    const mock = path.join(temporary, 'audit-query.cjs')
    fs.writeFileSync(mock, `const cp = require('node:child_process');
const real = cp.spawnSync;
cp.spawnSync = function(command, args, options) {
  if (Array.isArray(args) && args[0] === 'audit') {
    require('node:fs').writeFileSync(${JSON.stringify(path.join(temporary, 'audit-attempted'))}, 'yes');
    return {status: 1, stdout: JSON.stringify({error:{code:'ECONNREFUSED'}}), stderr: 'SYNTHETIC_SECRET'};
  }
  return real(command, args, options);
};
`)
    const run = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'gate:launch'], {
      cwd: temporary, encoding: 'utf8', shell: process.platform === 'win32',
      env: { ...process.env, NODE_OPTIONS: `--require="${mock.replaceAll('\\', '/')}"` },
    })
    assert.equal(fs.existsSync(path.join(temporary, 'audit-attempted')), true, run.stdout + run.stderr)
    assert.notEqual(run.status, 0)
    assert.match(run.stdout, /could not be verified/)
    assert.doesNotMatch(run.stdout + run.stderr, /\[PASS\]|SYNTHETIC_SECRET/)
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true })
  }
})
