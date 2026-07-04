import { describe, it, expect } from 'vitest'
// @ts-expect-error - check_db_types.js is a plain Node ESM tool (no .d.ts); we test its pure exports.
import { decide, parseBackendProvider } from '../tools/check_db_types.js'

// Extension runs with vitest; this file reimplements the same cases that
// tooling.discipline.test.js validates in the other lanes for check-db-types.
// check_db_types.js is byte-identical across the 4 templates; decide() is read-only and pure.

describe('check-db-types (7.3-B): pure decision + provider parser', () => {
  it('no-Supabase -> skip exit 0', () => {
    const r = decide({ provider: 'FIREBASE', strict: false, cliAvailable: false, committedExists: false })
    expect(r.code).toBe(0)
    expect(r.level).toBe('skip')
  })

  it('provider unset -> skip exit 0 (even in strict mode)', () => {
    const r = decide({ provider: null, strict: true, cliAvailable: false, committedExists: false })
    expect(r.code).toBe(0)
    expect(r.level).toBe('skip')
  })

  it('Supabase + no CLI/DB, normal mode -> warn exit 0', () => {
    const r = decide({ provider: 'SUPABASE', strict: false, cliAvailable: false, committedExists: true })
    expect(r.code).toBe(0)
    expect(r.level).toBe('warn')
  })

  it('Supabase + no CLI/DB, strict mode -> fail exit 1', () => {
    const r = decide({ provider: 'SUPABASE', strict: true, cliAvailable: false, committedExists: true })
    expect(r.code).toBe(1)
    expect(r.level).toBe('fail')
  })

  it('Supabase active but committed file is missing -> fail exit 1', () => {
    const r = decide({ provider: 'SUPABASE', strict: false, cliAvailable: true, committedExists: false })
    expect(r.code).toBe(1)
    expect(r.level).toBe('fail')
  })

  it('generated != committed -> fail exit 1 (drift)', () => {
    const r = decide({
      provider: 'SUPABASE', strict: false, cliAvailable: true, committedExists: true,
      committed: 'export type A = { id: number }\n',
      generated: 'export type A = { id: number; name: string }\n',
    })
    expect(r.code).toBe(1)
    expect(r.level).toBe('fail')
  })

  it('generated == committed, tolerant of CRLF -> ok exit 0', () => {
    const r = decide({
      provider: 'SUPABASE', strict: false, cliAvailable: true, committedExists: true,
      committed: 'export type A = { id: number }\r\n',
      generated: 'export type A = { id: number }\n',
    })
    expect(r.code).toBe(0)
    expect(r.level).toBe('ok')
  })

  it('parseBackendProvider ignores empty values and VITE_BACKEND_PROVIDER', () => {
    expect(parseBackendProvider('- BACKEND_PROVIDER:\n- LANE: WEB')).toBe(null)
    expect(parseBackendProvider('- BACKEND_PROVIDER: SUPABASE')).toBe('SUPABASE')
    expect(parseBackendProvider('- VITE_BACKEND_PROVIDER: Provider selection.')).toBe(null)
    expect(parseBackendProvider('- backend_provider = supabase')).toBe('SUPABASE')
    expect(parseBackendProvider('- BACKEND_PROVIDER: local-mock')).toBe('LOCAL-MOCK')
  })
})
