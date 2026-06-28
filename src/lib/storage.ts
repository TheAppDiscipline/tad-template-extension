/**
 * Typed wrappers around `browser.storage.local` and `browser.storage.sync`.
 * Defaults to `local` (per-device). Pass `area: 'sync'` for cross-device user
 * preferences (capped at ~100 KB total, per-item limits apply).
 */

type Area = 'local' | 'sync' | 'session'

export async function getStorage<T>(
  key: string,
  area: Area = 'local',
): Promise<T | undefined> {
  const result = await browser.storage[area].get(key)
  return result[key] as T | undefined
}

export async function setStorage<T>(
  key: string,
  value: T,
  area: Area = 'local',
): Promise<void> {
  await browser.storage[area].set({ [key]: value })
}

export async function removeStorage(
  key: string,
  area: Area = 'local',
): Promise<void> {
  await browser.storage[area].remove(key)
}
