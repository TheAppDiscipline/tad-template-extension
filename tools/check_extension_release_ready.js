#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = process.cwd()
const errors = []
const placeholderHashes = new Set([
  '383ef90d150b01d21c1bd463102e5d4681805607fd0d7609dca5af31d5cc8e41',
  'c8e9af2bec2b7dd2ab8aace403169caf5ee141db4043db6596de9008e3493e67',
  '0f743b52e3e207720834f98be8e5a5635307b6f849481b9c35f8f040388f5f9e',
])
const manifestPaths = [
  join(root, '.output', 'chrome-mv3', 'manifest.json'),
  join(root, '.output', 'firefox-mv3', 'manifest.json'),
]
const pkg = readPackage()

inspectContentScript()
for (const manifestPath of manifestPaths) inspectManifest(manifestPath)
for (const size of [16, 48, 128]) inspectSourceIcon(size)

if (errors.length) {
  console.error('[check-extension-release] FAILED:')
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}

console.log('[check-extension-release] OK - built manifests, icons, and content-script scope are release-specific.')

function inspectContentScript() {
  const contentScriptPath = join(root, 'entrypoints', 'content.ts')
  if (!existsSync(contentScriptPath)) return

  const source = readFileSync(contentScriptPath, 'utf8')
  const matchesArray = source.match(/matches\s*:\s*\[([\s\S]*?)\]/m)
  if (!matchesArray) {
    errors.push('entrypoints/content.ts must declare explicit matches, or be removed when the project has no content script.')
    return
  }

  const entries = matchesArray[1].trim()
  if (!entries) {
    errors.push('entrypoints/content.ts has matches: []. Configure real target URLs or remove the unused content script.')
  }
  if (entries.includes('<all_urls>') && process.env.DISCIPLINE_ALLOW_ALL_URLS !== '1') {
    errors.push('entrypoints/content.ts uses <all_urls>. Set DISCIPLINE_ALLOW_ALL_URLS=1 only after documenting the review impact, or narrow matches.')
  }
}

function inspectManifest(manifestPath) {
  const label = manifestPath.replace(`${resolve(root)}\\`, '').replaceAll('\\', '/')
  if (!existsSync(manifestPath)) {
    errors.push(`${label} is missing; run both release builds before gate:strict.`)
    return
  }

  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    errors.push(`${label} is not valid JSON: ${error.message}`)
    return
  }

  if (manifest.manifest_version !== 3) errors.push(`${label} must use manifest_version 3.`)
  for (const field of ['name', 'version', 'description']) {
    if (typeof manifest[field] !== 'string' || !manifest[field].trim()) {
      errors.push(`${label} must define a non-empty ${field}.`)
    }
  }
  if (pkg && manifest.version !== pkg.version) {
    errors.push(`${label} version ${manifest.version ?? 'missing'} does not match package.json version ${pkg.version}.`)
  }

  const buyerText = [manifest.name, manifest.description, manifest.action?.default_title]
    .filter((value) => typeof value === 'string')
    .join(' ')
  if (/discipline loop|tad-template-extension|\btemplate\b|\bscaffold(?:ed)?\b/i.test(buyerText)) {
    errors.push(`${label} still contains template identity in name, description, or action title.`)
  }

  for (const size of ['16', '48', '128']) {
    const iconPath = manifest.icons?.[size]
    if (typeof iconPath !== 'string' || !iconPath.trim()) {
      errors.push(`${label} must reference a ${size}px icon.`)
      continue
    }
    const builtIcon = join(manifestPath, '..', ...iconPath.split('/'))
    if (!existsSync(builtIcon)) errors.push(`${label} references missing icon ${iconPath}.`)
  }

  if (label.includes('firefox-mv3/manifest.json')) inspectFirefoxManifest(manifest, label)
}

function inspectFirefoxManifest(manifest, label) {
  const gecko = manifest.browser_specific_settings?.gecko
  const id = gecko?.id
  if (typeof id !== 'string' || !id.trim()) {
    errors.push(`${label} must define browser_specific_settings.gecko.id for Firefox MV3.`)
  } else if (/replace-me|example\.invalid|tad-template|discipline loop/i.test(id)) {
    errors.push(`${label} must replace the placeholder Firefox extension ID before release.`)
  }

  const minimum = Number.parseFloat(gecko?.strict_min_version)
  if (!Number.isFinite(minimum) || minimum < 140) {
    errors.push(`${label} must set browser_specific_settings.gecko.strict_min_version to Firefox 140 or newer for built-in data consent.`)
  }

  const permissions = gecko?.data_collection_permissions
  const required = permissions?.required
  const optional = permissions?.optional
  if (!Array.isArray(required) || required.length === 0 || required.some((value) => typeof value !== 'string' || !value.trim())) {
    errors.push(`${label} must declare non-empty Firefox data_collection_permissions.required.`)
  } else if (required.includes('none') && (required.length !== 1 || (Array.isArray(optional) && optional.length > 0))) {
    errors.push(`${label} may use Firefox data permission "none" only as the sole required category with no optional categories.`)
  }
  if (Array.isArray(optional) && optional.includes('none')) {
    errors.push(`${label} must not declare Firefox data permission "none" as optional.`)
  }
}

function readPackage() {
  const packagePath = join(root, 'package.json')
  if (!existsSync(packagePath)) {
    errors.push('package.json is missing.')
    return null
  }
  try {
    const value = JSON.parse(readFileSync(packagePath, 'utf8'))
    if (typeof value.version !== 'string' || !value.version.trim()) {
      errors.push('package.json must define a non-empty version.')
      return null
    }
    return value
  } catch (error) {
    errors.push(`package.json is not valid JSON: ${error.message}`)
    return null
  }
}

function inspectSourceIcon(size) {
  const iconPath = join(root, 'public', 'icon', `${size}.png`)
  if (!existsSync(iconPath)) {
    errors.push(`public/icon/${size}.png is missing.`)
    return
  }

  const bytes = readFileSync(iconPath)
  if (!isPng(bytes)) {
    errors.push(`public/icon/${size}.png is not a valid PNG header.`)
    return
  }
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  if (width !== size || height !== size) {
    errors.push(`public/icon/${size}.png must be ${size}x${size}; found ${width}x${height}.`)
  }
  const hash = createHash('sha256').update(bytes).digest('hex')
  if (placeholderHashes.has(hash)) errors.push(`public/icon/${size}.png is the shipped placeholder; replace it before launch/prod.`)
}

function isPng(bytes) {
  const signature = '89504e470d0a1a0a'
  return bytes.length >= 24 && bytes.subarray(0, 8).toString('hex') === signature
}
