# Discipline Loop Browser Extension Template

Discipline Loop Browser Extension template. **Chromium + Firefox** cross-browser via **WXT + React + TypeScript** under Manifest V3.

**Part of The App Discipline.** This is the public, MIT-licensed template (see `LICENSE`). The complete Discipline Loop methodology and vault (full system, playbooks, prompts, and extended materials) are a separate product, sold separately at <https://theappdiscipline.gumroad.com/l/tad>, and are **not** included in this repository.

**Template release:** v1.0.0. When you create a real extension from this template, keep strict semver in `package.json`; the Chrome Web Store and Firefox AMO require uploading a higher version than the previous one on each upload.

## What this template includes

- **Stack:** WXT 0.19+ · React 19 · Vite · TypeScript strict · CSS tokens
- **Entrypoints:** popup (360×480 fixed) · options page (web layout) · background (MV3 service worker) · content script (optional)
- **Messaging:** typed wrapper for `browser.runtime.sendMessage` + handlers in the background
- **Storage:** typed wrapper for `browser.storage.local` and `browser.storage.sync`
- **Gates:** lint + tsc + tests + tokens + secrets + `check-manifest` (validates MV3) + `check-bundle-extension` (zip < 10 MB)
- **Canonical Discipline Loop files:** `discipline.md`, `task_plan.md`, `findings.md`, `progress.md`, `progress_archive.md`, `AGENTS.md` (agent instructions; `CLAUDE.md` is a stub that imports it for Claude Code)
- **`.discipline/` folder** ready for packets, patches, paste-ready, run-log
- **Complete `tools/discipline/`** (ported from `tad-template-web`): `discipline:watch`, `discipline:patch`, `discipline:assemble`, `discipline:validate`, `discipline:validate:launch`, `discipline:validate:prod`, `discipline:cross-validate`, `discipline:hydrate`, `discipline:status`, `discipline:step1-prep`, `discipline:ai-scaffold`, `discipline:test-scaffold`, `discipline:progress`, `discipline:log`. Run via `tsx`.
- **Placeholder icons 16/48/128 PNG** in `public/icon/` (blue circle on gray). Replace before the first upload to CWS/AMO.

## Getting Started

**Prerequisite:** Node.js 22 or newer.

```bash
# Clone / use as template
gh repo create my-extension --template TheAppDiscipline/tad-template-extension

# Install
npm install

# Dev (opens Chromium with the extension loaded + HMR)
npm run dev

# Dev on Firefox
npm run dev:firefox

# Production build
npm run build           # Chromium
npm run build:firefox   # Firefox

# Deterministic gate before each slice
npm run gate

# Full gate before deploy
npm run gate:full

# Generate store-ready zips
npm run zip
# -> .output/*-chrome.zip  -> Chrome Web Store
# -> .output/*-firefox.zip -> Firefox AMO
```

## Configure your extension

1. Update `wxt.config.ts`:
   - `manifest.name`, `manifest.description`
   - `manifest.permissions` (least privilege — justify each one)
   - `manifest.host_permissions` if you have a content script

2. Replace the placeholder icons in `public/icon/` with real PNGs (16/48/128).

3. Update the canonical files:
   - `discipline.md` with the project switches (LANE=EXTENSION confirmed)
   - `task_plan.md` with the P0 slices

4. See The App Discipline vault (sold separately) for the complete workflow.

## Canonical pattern: free extension + web sidecar

This template assumes that if your extension needs auth/payments/cross-device sync, the backend lives in a separate **web sidecar app** (another repo built from `tad-template-web` + Supabase + magic link + Gumroad). The extension talks to the sidecar via `fetch` with a session token stored in `browser.storage.local`.

Do not put billing or full OAuth inside the extension — it is fragile and violates Chrome Web Store policies.

## Manifest V3 notes

- Ephemeral service worker (shuts down after ~30 s of inactivity) -> use `browser.storage.*`, never module-level variables for state.
- Strict CSP: **no `eval()` or `new Function()`**. Audit deps before adding them.
- No remote code at runtime: all executable JS ships bundled in the zip. Remote configuration/data can still be fetched.
