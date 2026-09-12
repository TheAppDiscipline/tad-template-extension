import { defineContentScript } from 'wxt/utils/define-content-script'

export default defineContentScript({
  // This optional scaffold is excluded from both supported browser builds.
  // To enable it, define the exact target URLs in matches, then remove exclude.
  // An empty matches array in the generated manifest prevents Chromium loading.
  exclude: ['chrome', 'firefox'],
  matches: [],
  runAt: 'document_idle',
  main() {
    // Empty by default. Add DOM-targeted logic here when you have a slice
    // that actually needs a content script. Use defensive selectors and
    // log clearly when the target DOM isn't found.
    //
    // Example:
    //   const target = document.querySelector('[data-discipline-target]')
    //   if (!target) {
    //     console.warn('[Discipline Loop Extension] target not found on', location.href)
    //     return
    //   }
  },
})
