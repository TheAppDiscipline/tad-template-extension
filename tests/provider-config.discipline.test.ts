import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

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

function output(result: ReturnType<typeof runTsx>): string {
  return `${result.stdout}${result.stderr}`
}

describe('provider contract enforcement', () => {
  it('rejects a stale generated artifact', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'discipline-provider-'))
    try {
      fs.copyFileSync(path.join(repoRoot, 'discipline.md'), path.join(projectRoot, 'discipline.md'))
      const artifact = path.join(projectRoot, 'src', 'config', 'provider.generated.json')
      fs.mkdirSync(path.dirname(artifact), { recursive: true })
      fs.writeFileSync(artifact, JSON.stringify({
        schema: 'discipline.provider-config/v1', backendProvider: 'SUPABASE', authMode: 'MAGIC_LINK',
      }), 'utf8')

      const result = runTsx('tools/discipline/provider-config.ts', ['--check', '--project-dir', projectRoot])
      expect(result.status).not.toBe(0)
      expect(output(result)).toMatch(/provider\.generated\.json is stale/)
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true })
    }
  })

  it('rejects a new direct provider environment consumer', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'discipline-provider-consumer-'))
    try {
      const rogue = path.join(projectRoot, 'src', 'config', 'rogue.ts')
      fs.mkdirSync(path.dirname(rogue), { recursive: true })
      fs.writeFileSync(rogue, 'export const provider = import.meta.env.VITE_BACKEND_PROVIDER\n', 'utf8')

      const result = runTsx('tools/discipline/check-provider-consumers.ts', ['--project-dir', projectRoot])
      expect(result.status).not.toBe(0)
      expect(output(result)).toMatch(/src[\\/]config[\\/]rogue\.ts:1/)
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true })
    }
  })
})
