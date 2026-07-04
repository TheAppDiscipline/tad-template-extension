<!--
  This is the project constitution. It will be populated by /discipline-step1
  with your app's contracts, switches, data model and Definition of Done.
  Do NOT rename the H2 anchor headings (## 0) Profile, ## 1) Non-Negotiables,
  etc.); the discipline:patch scripts depend on the exact heading text.
-->

# discipline.md — Project Constitution

## 0) Profile
- PROJECT_NAME: Discipline Loop Extension (placeholder)
- PRIMARY_GOAL:
- NORTH_STAR_METRIC:
- PROFILE: LITE
- BACKEND_PROVIDER: LOCAL_ONLY
- AUTH_MODE: NONE
- COLLAB_MODE: VIEW_ONLY
- STACK:
  - Frontend: Browser Extension (WXT + React + TypeScript)
  - Runtime: Manifest V3, Chromium + Firefox
  - Backend: Local storage by default; sidecar web app if auth/pagos/sync are needed
- SYNC_MODE: FAST_UI
- PUSH_PLUGIN: false
- AI_FEATURES: none
- LANE: EXTENSION

## Env Configuration
- Extension runtime config lives in `browser.storage.sync` or build-time env only when needed.
- Sidecar web app config belongs in the sidecar repo, not in the extension bundle.

## 1) Non-Negotiables
- (inherited from Discipline Loop)
- MV3 permissions must be minimum-privilege and justified in `findings.md`.
- No remote executable code; all runtime JS must be bundled.

## 2) Tenancy & Permissions
- Default: single-user local extension.
- If sidecar auth is added, document session token storage and permission boundary here.

## 3) Data Model
- For local extension state, describe `browser.storage.local` and `browser.storage.sync` keys and shapes.
- If a sidecar exists, link to the sidecar web repo data model.

## 4) API / IO Shapes
- List every `Message` type in `src/lib/messaging.ts` with request shape, response shape, and sender/receiver.
- If sidecar present: list every `fetch` call with method, path, request body, response shape and auth requirements.

## 5) Sync Rules
- Default: `FAST_UI` with browser storage as source of truth.
- Cross-device sync uses `browser.storage.sync` only for small preference payloads.
- Use sidecar backend for collaborative or paid state.

## 6) UI State Model
- Popup: 360x480 fixed surface with loading, empty, error and normal states.
- Options page: web-style layout with form validation and saved state.
- Content scripts must define injected, unavailable and permission-denied states.

## 7) Event / Notifications Model
- PUSH_PLUGIN=false by default.
- Background/service worker events must be idempotent; service workers are ephemeral.

## 8) Design Tokens Contract
- Tokens live in `src/styles/tokens.css`.
- No raw hex colors outside token files.
- Popup dimensions are part of the UI contract.

## 9) Testing / Gates Contract
- `npm run gate` must pass before any slice closes.
- Manual smoke: load unpacked extension in Chromium and Firefox.
- Any manifest permission change requires review evidence in `findings.md`.

## 10) LLM Contracts
- AI_FEATURES=none by default.
- If enabled, define prompt/schema/eval contracts in Step 2.5 before production use.

## 11) Universal Definition of Done
- `npm run gate` green.
- Popup/options render without console errors in Chromium and Firefox.
- Manifest permissions are minimal and justified.
- Slice completion is logged in `progress.md`.
