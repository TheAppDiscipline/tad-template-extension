import { defineBackground } from 'wxt/sandbox'
import type { Message } from '../src/lib/messaging'

type StorageMessage = Extract<Message, { type: 'GET_STORAGE' | 'SET_STORAGE' }>

function isStorageMessage(msg: unknown): msg is StorageMessage {
  if (!msg || typeof msg !== 'object') return false
  const candidate = msg as Partial<Message>
  return (
    (candidate.type === 'GET_STORAGE' || candidate.type === 'SET_STORAGE') &&
    typeof candidate.key === 'string'
  )
}

export default defineBackground(() => {
  // eslint-disable-next-line no-console
  console.log('[Discipline Loop Extension] background service worker started')

  browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!isStorageMessage(msg)) {
      sendResponse(undefined)
      return true
    }

    if (msg.type === 'GET_STORAGE') {
      browser.storage.local.get(msg.key).then((items) => {
        sendResponse(items[msg.key])
      })
      return true // keep message channel open for async response
    }

    if (msg.type === 'SET_STORAGE') {
      browser.storage.local.set({ [msg.key]: msg.value }).then(() => {
        sendResponse({ ok: true })
      })
      return true
    }

    // Unknown message types are ignored deliberately
    sendResponse(undefined)
    return true
  })
})
