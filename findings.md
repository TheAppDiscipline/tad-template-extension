<!--
  This file is filled progressively as your project advances. /discipline-step1
  seeds it; later steps add Decisions, Open Questions, Risks, Constraints,
  Assumptions and Deferred items via patch blocks. Do NOT rename the H2 section
  headings; discipline:patch depends on exact heading text.
-->

# findings.md

> Append-only. Decisions, open questions, risks, constraints, assumptions and deferred items.

## Decisions

### 2026-04-19 · Template creado

- Lane: EXTENSION (WXT + React + TypeScript, Manifest V3).
- Cross-browser target: Chromium + Firefox. Safari is out of scope for this template base.
- Canonical pattern: free extension + sidecar web app for Pro tier. No billing in-extension.

### 2026-04-19 · Plumbing completo portado

- `tools/discipline/` copied from `tad-template-web`.
- Runtime: `tsx` executes `.ts` tools directly.
- Dependencies added for Discipline Loop tooling: `tsx`, `@types/node`, `js-yaml`, `@types/js-yaml`.
- Placeholder 16/48/128 PNG icons generated in `public/icon/`; replace before first CWS/AMO upload.

### 2026-06-27 · WXT version pin

- wxt is pinned to ^0.19.29 on purpose: wxt 0.20 introduced a regression in the dev/build flow. Do not bump to 0.20+ without re-testing npm run dev / npm run build / npm run zip.

## Open Questions

- Which domains, if any, need `host_permissions`?
- Is a sidecar web app needed for auth, payments or sync?

## Risks

- MV3 service worker can stop unexpectedly; state must live in browser storage, not module globals.
- Permission creep can trigger store rejection or user distrust.
- Remote code is prohibited; all executable JS must be bundled.

## Constraints

- Manifest V3.
- Chromium + Firefox cross-browser support.
- No billing flow inside extension.

## Assumptions

- Initial profile is LITE with LOCAL_ONLY backend.
- Sidecar web app handles any future paid/pro account state.

## Deferred

- Safari lane.
- Paid sidecar.
- Store listing copy and final icons.
