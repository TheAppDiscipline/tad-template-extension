#!/usr/bin/env node
/**
 * check_no_hex_colors.js — Token gate.
 *
 * Forbids hex/rgb literals outside src/styles/tokens.css. Enforces the
 * visual-tokens-only rule (NN). Scans src/, entrypoints/.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'

const ALLOWED_FILES = new Set([
  'src/styles/tokens.css',
])

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/
const RGB_RE = /\brgba?\s*\(/

const ROOTS = ['src', 'entrypoints']
const EXTS = new Set(['.css', '.scss', '.ts', '.tsx', '.jsx'])

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
      if (ALLOWED_FILES.has(rel)) continue
      const text = readFileSync(file, 'utf8')
      if (HEX_RE.test(text) || RGB_RE.test(text)) {
        offenders.push(rel)
      }
    }
  } catch {
    // dir missing; skip
  }
}

if (offenders.length) {
  console.error('[check-tokens] FAILED — hex/rgb literals outside src/styles/tokens.css:')
  for (const f of offenders) console.error('  • ' + f)
  process.exit(1)
}
console.log('[check-tokens] OK — no hex/rgb literals outside tokens.css')
