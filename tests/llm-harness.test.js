import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { resolveProviderResponseSchema } from '../tools/llm_providers/response_schema.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

function withTempProject(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tad-extension-llm-'))
  try {
    return fn(dir)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

/** Run a repo script with the CWD pointed at a throwaway project. */
function runNode(script, args, cwd) {
  const result = spawnSync(process.execPath, [path.join(repoRoot, script), ...args], {
    cwd,
    encoding: 'utf8',
  })
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

describe('LLM harness', () => {
  it('resolveProviderResponseSchema prefers provider-specific, then aistudio, then canonical', () => {
    withTempProject((dir) => {
      const feature = 'demo'
      const promptsDir = path.join(dir, 'prompts')
      const featureDir = path.join(promptsDir, feature)
      fs.mkdirSync(featureDir, { recursive: true })

      const canonicalSchema = { $schema: 'x', type: 'object', additionalProperties: false }
      const aistudioSchema = { type: 'object', properties: { ok: { type: 'boolean' } } }
      const geminiSchema = { type: 'object', properties: { ok: { type: 'boolean' }, note: { type: 'string' } } }

      // Only the canonical exists -> fall back to it, flagged so the caller can warn.
      const fallback = resolveProviderResponseSchema({ feature, provider: 'gemini', canonicalSchema, promptsDir })
      expect(fallback.source).toBe('canonical')
      expect(fallback.path).toBeNull()

      // The generic minimal schema wins over the canonical.
      fs.writeFileSync(path.join(featureDir, 'schema.aistudio.json'), JSON.stringify(aistudioSchema), 'utf8')
      const generic = resolveProviderResponseSchema({ feature, provider: 'gemini', canonicalSchema, promptsDir })
      expect(generic.source).toBe('aistudio-generic')
      expect(generic.schema).toEqual(aistudioSchema)

      // A provider-specific schema wins over the generic one (provider name is case-insensitive).
      fs.writeFileSync(path.join(featureDir, 'schema.gemini.json'), JSON.stringify(geminiSchema), 'utf8')
      const specific = resolveProviderResponseSchema({ feature, provider: 'GEMINI', canonicalSchema, promptsDir })
      expect(specific.source).toBe('provider-specific')
      expect(specific.schema).toEqual(geminiSchema)

      // Another provider with no specific file falls back to the generic one.
      const other = resolveProviderResponseSchema({ feature, provider: 'openai', canonicalSchema, promptsDir })
      expect(other.source).toBe('aistudio-generic')
    })
  })

  it('the ok/data/error envelope template enforces its invariants (a loose envelope propagates to every new project)', () => {
    const schema = JSON.parse(fs.readFileSync(path.join(repoRoot, 'prompts', '_templates', 'schema.json'), 'utf8'))
    const ajv = new Ajv2020({ allErrors: true, strict: false })
    addFormats(ajv)
    const validate = ajv.compile(schema)

    const err = (over = {}) => ({ code: 'NONE', message: 'ok', missing_fields: [], retryable: false, ...over })
    const payload = (over = {}) => ({ schema_version: 'v1', request_id: 'r', ok: true, data: {}, error: err(), ...over })

    // Accepted.
    expect(validate(payload())).toBe(true) // the llm_smoke_test success payload
    expect(validate(payload({ schema_version: 'v2' }))).toBe(true) // schema_version stays a pattern: a project may ship v2
    expect(validate(payload({ ok: false, data: null, error: err({ code: 'MISSING_FIELDS', message: 'm', missing_fields: ['x'], retryable: false }) }))).toBe(true)
    expect(validate(payload({ ok: false, data: null, error: err({ code: 'PROVIDER_ERROR', message: 'm', retryable: true }) }))).toBe(true) // transient errors are retryable

    // Rejected: the laxities that used to let broken envelopes through.
    expect(validate(payload({ data: null }))).toBe(false) // ok:true must carry data
    expect(validate(payload({ ok: false, data: {}, error: err({ code: 'INVALID_INPUT', message: 'm' }) }))).toBe(false) // ok:false must null out data
    expect(validate(payload({ ok: false, data: null }))).toBe(false) // ok:false must not report code NONE
    expect(validate(payload({ error: err({ message: 'todo salió bien' }) }))).toBe(false) // on success the message is exactly "ok"
    expect(validate(payload({ error: err({ retryable: true }) }))).toBe(false) // success is never retryable
    expect(validate(payload({ error: err({ missing_fields: ['x'] }) }))).toBe(false) // missing_fields is scoped to MISSING_FIELDS
    expect(validate(payload({ ok: false, data: null, error: err({ code: 'MISSING_FIELDS', message: 'm', missing_fields: ['x'], retryable: true }) }))).toBe(false) // a retry cannot supply the field
    expect(validate(payload({ ok: false, data: null, error: err({ code: 'AMBIGUOUS', message: 'm', retryable: true }) }))).toBe(false) // a retry cannot disambiguate
    expect(validate(payload({ ok: false, data: null, error: err({ code: 'MISSING_FIELDS', message: 'm', missing_fields: [], retryable: false }) }))).toBe(false) // MISSING_FIELDS must name the fields
  })

  it('llm_eval actually runs: fixture mode compiles a draft 2020-12 schema and validates the output', () => {
    withTempProject((dir) => {
      const feature = 'draft2020'
      fs.writeFileSync(path.join(dir, 'discipline.md'), '- AI_FEATURES: enabled\n', 'utf8')
      fs.mkdirSync(path.join(dir, 'prompts', feature), { recursive: true })
      fs.mkdirSync(path.join(dir, 'evals'), { recursive: true })
      fs.writeFileSync(path.join(dir, 'prompts', feature, 'system.md'), 'Return JSON only.\n', 'utf8')
      fs.writeFileSync(path.join(dir, 'prompts', feature, 'schema.json'), JSON.stringify({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        additionalProperties: false,
        required: ['ok'],
        properties: { ok: { type: 'boolean' } },
      }), 'utf8')
      fs.writeFileSync(path.join(dir, 'evals', `${feature}.jsonl`), `${JSON.stringify({
        id: 'valid-draft2020-output',
        input: { source: 'fixture' },
        expected: { ok: true },
        actual: { ok: true },
      })}\n`, 'utf8')

      const result = runNode('tools/llm_eval.js', ['--mode=fixture'], dir)

      expect(result.status, result.output).toBe(0)
      expect(result.output).toMatch(/\[PASS\] valid-draft2020-output/)
      expect(result.output).toMatch(/RESULT: PASS/)
    })
  })

  it('ai:smoke AND ai:eval both skip cleanly when AI_FEATURES=none', () => {
    withTempProject((dir) => {
      // Each script guards on isAiEnabled() independently, so both must be proven.
      fs.writeFileSync(path.join(dir, 'discipline.md'), '- AI_FEATURES: none\n', 'utf8')

      const smoke = runNode('tools/llm_smoke_test.js', [], dir)
      expect(smoke.status, smoke.output).toBe(0)
      expect(smoke.output).toMatch(/\[SKIP\]/)

      const evals = runNode('tools/llm_eval.js', ['--mode=fixture'], dir)
      expect(evals.status, evals.output).toBe(0)
      expect(evals.output).toMatch(/\[SKIP\]/)
    })
  })
})
