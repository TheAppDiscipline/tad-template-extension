/**
 * Typed wrapper for extension messaging between contexts
 * (popup/options/content ↔ background service worker).
 *
 * Add a discriminated-union variant to `Message` for every new message type
 * your slice needs. Document the contract in discipline.md §Contracts.
 */

export type Message =
  | { type: 'GET_STORAGE'; key: string }
  | { type: 'SET_STORAGE'; key: string; value: unknown }
  | { type: 'REFRESH_DATA' }

export async function sendMessage<T>(msg: Message): Promise<T> {
  return browser.runtime.sendMessage(msg) as Promise<T>
}
