# task_plan.md — Plan by Phases + Slices

## 1) Current Goal
- Verify extension template scaffolding and then define P0 slices from the Step 4 packet.

## 2) Definition of Ready
- Contracts clear.
- Messaging/storage shapes clear.
- Manifest permissions justified.
- Acceptance criteria testable in Chromium and Firefox.

## 3) Definition of Done
- `npm run gate` passes.
- Extension smoke-tested in Chromium and Firefox when UI/runtime changed.
- Docs updated.
- Slice completion packet emitted.

## 4) Ready Slices

## Slice 0 - Extension Bootstrap Verification
### Goal
Verify the WXT extension template, manifest, messaging and gate.
#### Scope IN
- Run `npm install`.
- Run `npm run dev` and load Chromium extension.
- Run `npm run dev:firefox` when Firefox support matters.
- Confirm popup renders placeholder without console errors.
- Confirm options page persists `apiBase` via `browser.storage.sync`.
- Run `npm run gate`.
#### Scope OUT
- Business logic.
- Sidecar auth/pagos/sync.
- Content script features beyond template placeholder.
#### Contracts
- Messaging wrapper returns typed responses.
- Storage wrapper persists and reads expected keys.
#### UI States
- Popup and options page have loading/error/normal states as relevant.
#### Acceptance Criteria
- [ ] `npm run gate` passes.
- [ ] Popup renders in Chromium.
- [ ] Firefox build passes.
- [ ] `discipline.md` updated with project switches.
#### Notes
- Use sidecar web app for billing, OAuth-heavy flows or paid sync.

## 5) Deferred / Later
- Safari support.
- Sidecar paid tier.
- Content script injection into third-party pages.

## 6) Risks and Dependencies
- Chrome Web Store / Firefox AMO policy review.
- MV3 service worker lifecycle.
- Permission creep in `manifest.permissions` and `host_permissions`.
