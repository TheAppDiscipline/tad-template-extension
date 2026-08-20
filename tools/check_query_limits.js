#!/usr/bin/env node
/**
 * check_query_limits.js - NN #23.1 (SEMI: warn by default, fail with --strict).
 *
 * Flags Supabase queries `.from(x).select()` that don't have `.limit`,
 * `.range`, or `.single`. Only relevant when the extension talks to a
 * sidecar with Supabase. Stub until that applies.
 */
import process from 'node:process'

const strict = process.argv.includes('--strict')

// Intentional lane limitation: this scanner is inactive while the extension
// has no Supabase sidecar. The slice that adds one must port the Web scanner.

if (strict) {
  console.log('[check-queries:strict] OK (stub - no sidecar Supabase detected)')
} else {
  console.log('[check-queries] OK (stub - no sidecar Supabase detected)')
}
