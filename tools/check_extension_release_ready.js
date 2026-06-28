#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const contentScriptPath = join(process.cwd(), 'entrypoints', 'content.ts')
const source = readFileSync(contentScriptPath, 'utf8')
const errors = []

const matchesArray = source.match(/matches\s*:\s*\[([\s\S]*?)\]/m)

if (!matchesArray) {
  errors.push('entrypoints/content.ts must declare explicit content-script matches before launch/prod.')
} else {
  const entries = matchesArray[1].trim()
  if (!entries) {
    errors.push('entrypoints/content.ts has matches: []. Replace it with real target URLs before launch/prod.')
  }

  if (entries.includes('<all_urls>') && !process.env.DISCIPLINE_ALLOW_ALL_URLS) {
    errors.push('entrypoints/content.ts uses <all_urls>. Set DISCIPLINE_ALLOW_ALL_URLS=1 only after documenting the review impact, or narrow matches.')
  }
}

if (errors.length) {
  console.error('[check-extension-release] FAILED:')
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}

console.log('[check-extension-release] OK - content script release scope is explicit.')
