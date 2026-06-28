#!/usr/bin/env node
/**
 * check_https_redirect.js — NN #17.4.
 *
 * Flags http:// URLs (non-localhost) in source code that might be hardcoded
 * for sidecar fetches. Extensions should always talk to sidecar over HTTPS.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'

const ROOTS = ['src', 'entrypoints']
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx'])
const HTTP_RE = /\bhttp:\/\/(?!(localhost|127\.0\.0\.1|0\.0\.0\.0))[^\s"')]+/g

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, out)
    else if (EXTS.has(p.slice(p.lastIndexOf('.')))) out.push(p)
  }
  return out
}

const offenders = []
for (const root of ROOTS) {
  try {
    for (const file of walk(root)) {
      const rel = relative(process.cwd(), file).replace(/\\/g, '/')
      const text = readFileSync(file, 'utf8')
      const matches = text.match(HTTP_RE)
      if (matches) offenders.push(`${rel} · ${matches.join(', ')}`)
    }
  } catch {
    // dir missing; skip
  }
}

if (offenders.length) {
  console.error('[check-https] FAILED — non-localhost http:// URLs in source:')
  for (const f of offenders) console.error('  • ' + f)
  process.exit(1)
}
console.log('[check-https] OK — no insecure http:// URLs')
