# Discipline Loop Browser Extension Template

Discipline Loop Browser Extension template. **Chromium + Firefox** cross-browser via **WXT + React + TypeScript** under Manifest V3.

**Part of The App Discipline.** This template is MIT-licensed (see `LICENSE`) and can be used on its own. The proprietary Discipline Loop vault is not covered by this repository's MIT license. If you received the paid bundle, the vault is the sibling folder `The App Discipline Vault/`; otherwise, verify the current offer and availability in the seller's checkout before relying on it.

**Template release prepared:** v1.0.2, not published yet. When you create a real extension from this template, keep strict semver in `package.json`; the Chrome Web Store and Firefox AMO require uploading a higher version than the previous one on each upload.

## Inicio rápido desde el bundle

Usa esta ruta si recibiste `Templates/tad-template-extension` dentro del bundle de The App Discipline:

1. Copia esta carpeta completa a una carpeta de trabajo nueva. No trabajes dentro del bundle ni combines la copia con un proyecto anterior.
2. Abre una terminal en la copia. El directorio correcto contiene `package.json`.
3. Ejecuta, en orden:

```bash
npm install
npm run discipline:hydrate -- --lane EXTENSION --profile LITE --backend LOCAL_ONLY --auth NONE --sync NONE
npm run discipline:status
npm run gate
```

En Windows PowerShell usa `npm.cmd` en lugar de `npm`. Si ves `npm.ps1 cannot be loaded`, repite el mismo comando con `npm.cmd`; no necesitas cambiar la política del sistema.

**Resultado esperado:** hydrate informa `Project hydrated`, status termina en `Status: OK` y gate vuelve al prompt sin error después de generar builds Chromium y Firefox. El gate no demuestra instalación manual, interacción por teclado, lector de pantalla, permisos reales ni aprobación de Chrome Web Store o Firefox AMO.

**Siguiente prueba manual:** corre `npm run dev`, usa el navegador que abra WXT y prueba popup, options y permisos. Antes de publicar reemplaza iconos, nombre, descripción y permisos; una cuenta de tienda y su decisión de upload siguen siendo humanas.

**Si falla:** conserva el primer error rojo y el comando exacto. Corre `npm run discipline:doctor` (`npm.cmd run discipline:doctor` en PowerShell), corrige una causa a la vez y repite. Después de dos intentos sin información nueva, detente y registra el blocker en `progress.md`.

Para volver otro día, lee `progress.md` y corre `npm run discipline:status`. `LITE` es local; `LAUNCH` requiere evidencia antes de abrir a terceros; `PROD` requiere operación comercial verificada. La IA no decide por ti alcance, costos, credenciales, permisos, legal/fiscal, cobros ni publicación.

## What this template includes

- **Stack:** WXT 0.19+ · React 19 · Vite · TypeScript strict · CSS tokens
- **Entrypoints:** popup (360×480 fixed) · options page (web layout) · background (MV3 service worker) · content script (optional)
- **Messaging:** typed wrapper for `browser.runtime.sendMessage` + handlers in the background
- **Storage:** typed wrapper for `browser.storage.local` and `browser.storage.sync`
- **Gates:** lint + tsc + tests + tokens + secrets + `check-manifest` (validates MV3) + `check-bundle-extension` (zip < 10 MB)
- **Canonical Discipline Loop files:** `discipline.md`, `task_plan.md`, `findings.md`, `progress.md`, `progress_archive.md`, `AGENTS.md` (agent instructions; `CLAUDE.md` is a stub that imports it for Claude Code)
- **`.discipline/` folder** ready for packets, patches, paste-ready, run-log
- **Complete `tools/discipline/`** (ported from `tad-template-web`), including measured slice metrics and the deterministic compact state view. Run `npm run discipline:metrics -- --slice S1 --base main`, or `npm run --silent discipline -- state-view --json` for JSON-only stdout (`npm.cmd` in PowerShell).
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

# Full development gate
npm run gate:full

# After configuring release identity, scope, icons, and Firefox metadata:
# run the fail-closed release gate, then generate and inspect both ZIPs
npm run release:check
# -> .output/*-chrome.zip  -> Chrome Web Store
# -> .output/*-firefox.zip -> Firefox AMO
```

## Configure your extension

1. Update `wxt.config.ts`:
   - `manifest.name`, `manifest.description`
   - `manifest.permissions` (least privilege - justify each one)
   - `manifest.host_permissions` if you have a content script
   - `browser_specific_settings.gecko.id` with your stable Firefox extension ID
   - `data_collection_permissions`: keep `required: ['none']` only while the extension collects or transmits no data; otherwise declare the applicable Firefox categories
   - `strict_min_version: '140.0'` while using Firefox built-in data consent without a legacy fallback

2. Replace the placeholder icons in `public/icon/` with real PNGs (16/48/128).

3. Update the canonical files:
   - `discipline.md` with the project switches (LANE=EXTENSION confirmed)
   - `task_plan.md` with the P0 slices

4. Run `npm run release:check`. It must pass before treating either ZIP as ready for store review.

5. See The App Discipline vault (sold separately) for the complete workflow.

## Canonical pattern: free extension + web sidecar

This template assumes that if your extension needs auth/payments/cross-device sync, the backend lives in a separate **web sidecar app** (another repo built from `tad-template-web` + Supabase + magic link + Gumroad). The extension talks to the sidecar via `fetch` with a session token stored in `browser.storage.local`.

Do not put billing or full OAuth inside the extension - it is fragile and violates Chrome Web Store policies.

## Manifest V3 notes

- Ephemeral service worker (shuts down after ~30 s of inactivity) -> use `browser.storage.*`, never module-level variables for state.
- Strict CSP: **no `eval()` or `new Function()`**. Audit deps before adding them.
- No remote code at runtime: all executable JS ships bundled in the zip. Remote configuration/data can still be fetched.
