import { defineContentScript } from 'wxt/sandbox'

export default defineContentScript({
  // Matches kept broad-but-inert by default; narrow this to real target URLs
  // before publishing. "<all_urls>" will slow Chrome Web Store review.
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
