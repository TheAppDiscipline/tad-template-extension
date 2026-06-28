#!/usr/bin/env node
/**
 * check_magic_numbers.js — NN #9 (SEMI: warn by default, fail with --strict).
 *
 * Flags magic numeric literals in JSX/TSX style props (padding, margin,
 * width, height, etc.) that should use tokens or named constants.
 *
 * Stub: replicate rules from tad-template-web/tools/check_magic_numbers.js
 * once your extension has actual UI with lots of inline styles.
 */
import process from 'node:process'

const strict = process.argv.includes('--strict')

// TODO: implement same scanning logic as tad-template-web when the
// extension accumulates enough inline styles to warrant it. Until then,
// this script is a no-op gate placeholder that doesn't block.

if (strict) {
  console.log('[check-magic:strict] OK (stub — no rules active yet)')
} else {
  console.log('[check-magic] OK (stub — no rules active yet)')
}
