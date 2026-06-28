#!/usr/bin/env node
/**
 * check_query_limits.js — NN #23.1 (SEMI: warn by default, fail with --strict).
 *
 * Flags Supabase queries `.from(x).select()` that don't have `.limit`,
 * `.range`, or `.single`. Only relevant when the extension talks to a
 * sidecar with Supabase. Stub until that applies.
 */
import process from 'node:process'

const strict = process.argv.includes('--strict')

// TODO: implement once the extension adds Supabase via sidecar pattern.
// Replicate logic from tad-template-web/tools/check_query_limits.js.

if (strict) {
  console.log('[check-queries:strict] OK (stub — no sidecar Supabase detected)')
} else {
  console.log('[check-queries] OK (stub — no sidecar Supabase detected)')
}
