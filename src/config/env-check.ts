/**
 * Startup validation for environment-like config.
 *
 * Extensions don't have runtime `.env` — config comes from either:
 *   1. Build-time env via WXT modes (WXT_* env vars baked at build).
 *   2. User-provided config via options page -> browser.storage.sync.
 *
 * Fail fast at load time if required config is missing. This avoids
 * weird silent failures deep inside message handlers.
 */

export function assertBuildConfig(): void {
  // Example:
  //   if (!import.meta.env.WXT_SIDECAR_URL) {
  //     throw new Error('WXT_SIDECAR_URL not set at build time')
  //   }
}
