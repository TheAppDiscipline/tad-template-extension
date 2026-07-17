import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Extension runs its tests with vitest (not node:test), so this file reimplements
// in vitest the Gate D scorecard assertions that tooling.discipline.test.js carries
// in the other lanes. tools/discipline/validate-scorecard.ts is byte-identical across
// the 4 templates; this suite protects the extension copy against drift.
//
// The not_applicable cases below cover a reproduced false green: a critical item with
// status=not_applicable and no applies_when used to fall through every branch, so Gate D
// printed "Passed: 0/10" and still exited 0.

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

function getOutput(result: ReturnType<typeof runTsx>): string {
  return `${result.stdout}${result.stderr}`
}

function createDisciplineProject(): string {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'discipline-scorecard-'))

  for (const fileName of ['discipline.md', 'task_plan.md', 'findings.md', 'progress.md']) {
    fs.copyFileSync(path.join(repoRoot, fileName), path.join(projectRoot, fileName))
  }

  fs.mkdirSync(path.join(projectRoot, '.discipline', 'packets'), { recursive: true })
  fs.mkdirSync(path.join(projectRoot, '.discipline', 'patches', 'pending'), { recursive: true })
  fs.mkdirSync(path.join(projectRoot, '.discipline', 'patches', 'applied'), { recursive: true })
  fs.mkdirSync(path.join(projectRoot, '.discipline', 'paste-ready'), { recursive: true })

  return projectRoot
}

function writeScorecard(projectRoot: string, content: string): void {
  fs.writeFileSync(path.join(projectRoot, '.discipline', 'scorecard.yaml'), content, 'utf8')
}

// applies_when is evaluated against the switches parsed out of discipline.md, so the
// same scorecard means different things depending on this value. The template ships
// without a BILLING switch, which reads as false ("" != "true") and makes a
// `BILLING == true` item inapplicable.
function setSwitch(projectRoot: string, key: string, value: string): void {
  const disciplinePath = path.join(projectRoot, 'discipline.md')
  const content = fs.readFileSync(disciplinePath, 'utf8')
  fs.writeFileSync(disciplinePath, `${content}\n- ${key}: ${value}\n`, 'utf8')
}

function runLaunchGate(projectRoot: string) {
  return runTsx('tools/discipline/validate-scorecard.ts', ['--mode', 'launch', '--project-dir', projectRoot])
}

describe('Gate D (launch scorecard)', () => {
  it('rejects critical done items without evidence', () => {
    const projectRoot = createDisciplineProject()
    writeScorecard(projectRoot, `meta:
  project: Fixture
  profile_target: LAUNCH
launch:
  critical:
    - id: L1
      name: Smoke test
      status: done
      severity: CRITICAL
`)

    const result = runLaunchGate(projectRoot)

    expect(result.status, getOutput(result)).not.toBe(0)
    expect(getOutput(result)).toMatch(/done without evidence \(CRITICAL\)/)
  })

  it('rejects critical not_applicable items without applies_when', () => {
    const projectRoot = createDisciplineProject()
    writeScorecard(projectRoot, `meta:
  project: Fixture
  profile_target: LAUNCH
launch:
  critical:
    - id: L1
      name: Privacy policy published
      status: not_applicable
      severity: CRITICAL
`)

    const result = runLaunchGate(projectRoot)

    expect(result.status, getOutput(result)).not.toBe(0)
    expect(getOutput(result)).toMatch(/not_applicable without applies_when \(CRITICAL\)/)
  })

  it('rejects not_applicable when applies_when is true (escape attempt)', () => {
    const projectRoot = createDisciplineProject()
    setSwitch(projectRoot, 'BILLING', 'true')
    writeScorecard(projectRoot, `meta:
  project: Fixture
  profile_target: LAUNCH
launch:
  critical:
    - id: L1
      name: Billing flow audited
      status: not_applicable
      severity: CRITICAL
      applies_when: "BILLING == true"
`)

    const result = runLaunchGate(projectRoot)

    expect(result.status, getOutput(result)).not.toBe(0)
    expect(getOutput(result)).toMatch(/escape attempt/)
  })

  it('accepts not_applicable when applies_when is false', () => {
    const projectRoot = createDisciplineProject()
    setSwitch(projectRoot, 'BILLING', 'false')
    writeScorecard(projectRoot, `meta:
  project: Fixture
  profile_target: LAUNCH
launch:
  critical:
    - id: L1
      name: Billing flow audited
      status: not_applicable
      severity: CRITICAL
      applies_when: "BILLING == true"
`)

    const result = runLaunchGate(projectRoot)

    expect(result.status, getOutput(result)).toBe(0)
  })
})
