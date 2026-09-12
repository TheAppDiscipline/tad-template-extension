#!/usr/bin/env node
/**
 * check_bundle_extension.js - Validates extension bundle sizes.
 *
 * The template's default release policy is 10 MB per ZIP. Override it with
 * DISCIPLINE_EXTENSION_ZIP_LIMIT_MB when the project documents another budget.
 *
 * Runs after `npm run zip`. Checks:
 *   - .output/*.zip exists
 *   - each zip <= LIMIT_MB (default 10)
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const LIMIT_MB = Number(process.env.DISCIPLINE_EXTENSION_ZIP_LIMIT_MB ?? 10)
const OUTPUT_ROOT = '.output'
const packagePath = 'package.json'

if (!Number.isFinite(LIMIT_MB) || LIMIT_MB <= 0) {
  console.error('[check-bundle-extension] DISCIPLINE_EXTENSION_ZIP_LIMIT_MB must be a positive number')
  process.exit(1)
}

if (!existsSync(OUTPUT_ROOT)) {
  console.error(`[check-bundle-extension] ${OUTPUT_ROOT}/ not found - run \`npm run zip\` first`)
  process.exit(1)
}

const zips = readdirSync(OUTPUT_ROOT).filter((f) => f.endsWith('.zip'))
let pkg
try {
  pkg = JSON.parse(readFileSync(packagePath, 'utf8'))
} catch (error) {
  console.error(`[check-bundle-extension] ${packagePath} is missing or invalid: ${error.message}`)
  process.exit(1)
}
if (typeof pkg.name !== 'string' || !pkg.name.trim() || typeof pkg.version !== 'string' || !pkg.version.trim()) {
  console.error('[check-bundle-extension] package.json must define non-empty name and version fields')
  process.exit(1)
}

const artifactBase = pkg.name.replace(/^@/, '').replaceAll('/', '-') + '-' + pkg.version
const expectedZips = [`${artifactBase}-chrome.zip`, `${artifactBase}-firefox.zip`]
const missingZips = expectedZips.filter((zip) => !zips.includes(zip))
if (missingZips.length) {
  console.error(`[check-bundle-extension] Missing current ZIP artifact(s): ${missingZips.join(', ')} - run \`npm run zip\` first`)
  process.exit(1)
}
const staleZips = zips.filter((zip) => !zip.startsWith(`${artifactBase}-`))
if (staleZips.length) console.warn(`[check-bundle-extension] Ignoring ${staleZips.length} stale/unrelated ZIP(s): ${staleZips.join(', ')}`)

const errors = []
for (const zip of expectedZips) {
  const full = join(OUTPUT_ROOT, zip)
  const sizeMb = statSync(full).size / 1024 / 1024
  const label = `${zip}: ${sizeMb.toFixed(2)} MB`
  if (statSync(full).size === 0) {
    errors.push(`${zip}: empty ZIP artifact`)
  } else if (sizeMb > LIMIT_MB) {
    errors.push(`${label} - exceeds ${LIMIT_MB} MB limit`)
  } else {
    console.log(`[check-bundle-extension] OK · ${label}`)
  }
}

if (errors.length) {
  console.error('\n[check-bundle-extension] FAILED:')
  for (const e of errors) console.error('  • ' + e)
  process.exit(1)
}
