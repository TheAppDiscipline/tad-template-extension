#!/usr/bin/env node
/**
 * check_bundle_extension.js — Validates extension bundle sizes.
 *
 * Chrome Web Store hard limit: 100 MB. Practical limit for indie extensions: 10 MB
 * (review friction + user trust). Firefox AMO is similar.
 *
 * Runs after `npm run zip`. Checks:
 *   - .output/*.zip exists
 *   - each zip <= LIMIT_MB (default 10)
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const LIMIT_MB = Number(process.env.DISCIPLINE_EXTENSION_ZIP_LIMIT_MB ?? 10)
const OUTPUT_ROOT = '.output'

if (!existsSync(OUTPUT_ROOT)) {
  console.error(`[check-bundle-extension] ${OUTPUT_ROOT}/ not found — run \`npm run zip\` first`)
  process.exit(1)
}

const zips = readdirSync(OUTPUT_ROOT).filter((f) => f.endsWith('.zip'))
if (!zips.length) {
  console.warn('[check-bundle-extension] No .zip files in .output/ — run `npm run zip` first')
  process.exit(0)
}

const errors = []
for (const zip of zips) {
  const full = join(OUTPUT_ROOT, zip)
  const sizeMb = statSync(full).size / 1024 / 1024
  const label = `${zip}: ${sizeMb.toFixed(2)} MB`
  if (sizeMb > LIMIT_MB) {
    errors.push(`${label} — exceeds ${LIMIT_MB} MB limit`)
  } else {
    console.log(`[check-bundle-extension] OK · ${label}`)
  }
}

if (errors.length) {
  console.error('\n[check-bundle-extension] FAILED:')
  for (const e of errors) console.error('  • ' + e)
  process.exit(1)
}
