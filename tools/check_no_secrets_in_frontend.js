#!/usr/bin/env node
/**
 * check_no_secrets_in_frontend.js — NN #17.1 secrets in bundle.
 *
 * Extension source and bundle are fully inspectable by users. Fails if common
 * secret patterns or server-only references appear in shipped code.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'

const ROOTS = ['src', 'entrypoints', 'public', '.output', 'tools']
const CLIENT_ROOTS = ['src', 'entrypoints', 'public', '.output']

const LITERAL_PATTERNS = [
  { name: 'Anthropic API key', re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'OpenAI project key', re: /sk-proj-[A-Za-z0-9_-]{20,}/ },
  { name: 'Generic API secret key', re: /sk-[A-Za-z0-9_-]{32,}/ },
  { name: 'Stripe live secret', re: /sk_live_[A-Za-z0-9]{24,}/ },
  { name: 'Stripe test secret', re: /sk_test_[A-Za-z0-9]{24,}/ },
  { name: 'Supabase secret key', re: /sb_secret_[A-Za-z0-9_-]{20,}/ },
  { name: 'JWT-like token', re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/ },
  { name: 'Generic bearer token (long)', re: /Bearer\s+[A-Za-z0-9._-]{40,}/ },
  { name: 'AWS access key', re: /AKIA[0-9A-Z]{16}/ },
]

const CLIENT_REFERENCE_PATTERNS = [
  // Any token containing SERVICE_ROLE, including prefixed forms like
  // VITE_SERVICE_ROLE_KEY / WXT_SERVICE_ROLE_KEY the old anchored pattern missed (A4).
  { name: 'service_role reference', re: /service[_-]?role/i },
  { name: 'Server-only process.env reference', re: /process\.env\.(?!VITE_|EXPO_PUBLIC_|WXT_)[A-Z0-9_]+/ },
  { name: 'Server-only process.env[...] bracket reference', re: /process\.env\[\s*['"](?!VITE_|EXPO_PUBLIC_|WXT_)[A-Za-z_]/ },
  // Non-public import.meta.env access in client code (WXT/Vite only expose public
  // prefixes); reading any other name (dot OR bracket) is an attempt to pull a
  // server secret (A4).
  { name: 'Non-public import.meta.env reference', re: /import\.meta\.env\.(?!(?:VITE_|EXPO_PUBLIC_|WXT_|NEXT_PUBLIC_|PUBLIC_)|(?:MODE|DEV|PROD|SSR|BASE_URL)\b)[A-Za-z_][A-Za-z0-9_]*/ },
  { name: 'Non-public import.meta.env[...] bracket reference', re: /import\.meta\.env\[\s*['"](?!(?:VITE_|EXPO_PUBLIC_|WXT_|NEXT_PUBLIC_|PUBLIC_|MODE|DEV|PROD|SSR|BASE_URL))[A-Za-z_]/ },
]

const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, out)
    else if (EXTS.has(p.slice(p.lastIndexOf('.')))) out.push(p)
  }
  return out
}

function isClientFile(file) {
  const rel = relative(process.cwd(), file).replace(/\\/g, '/')
  return CLIENT_ROOTS.some((root) => rel === root || rel.startsWith(`${root}/`))
}

const offenders = []
for (const root of ROOTS) {
  try {
    for (const file of walk(root)) {
      const rel = relative(process.cwd(), file).replace(/\\/g, '/')
      const text = readFileSync(file, 'utf8')
      const patterns = isClientFile(file)
        ? [...LITERAL_PATTERNS, ...CLIENT_REFERENCE_PATTERNS]
        : LITERAL_PATTERNS
      for (const p of patterns) {
        if (p.re.test(text)) offenders.push(`${rel} · ${p.name}`)
      }
    }
  } catch {
    // dir missing; skip
  }
}

if (offenders.length) {
  console.error('[check-secrets] FAILED — secret-like strings found in bundled/client code:')
  for (const f of offenders) console.error('  • ' + f)
  process.exit(1)
}
console.log('[check-secrets] OK — no secret patterns in bundled/client code')
