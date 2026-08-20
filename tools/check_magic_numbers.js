#!/usr/bin/env node
/**
 * check_magic_numbers.js - NN #9 (SEMI: warn by default, fail with --strict).
 *
 * Flags magic numeric literals in JSX/TSX style props (padding, margin,
 * width, height, etc.) that should use tokens or named constants.
 *
 * Stub: replicate rules from tad-template-web/tools/check_magic_numbers.js
 * once your extension has actual UI with lots of inline styles.
 */
import process from 'node:process'

const strict = process.argv.includes('--strict')

// Intentional lane limitation: this scanner has no active rules until the
// extension owns inline UI styles. When that surface is added, port the Web
// scanner in the same slice instead of treating this message as coverage.

if (strict) {
  console.log('[check-magic:strict] OK (stub - no rules active yet)')
} else {
  console.log('[check-magic] OK (stub - no rules active yet)')
}
