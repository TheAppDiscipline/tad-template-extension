# Icons

Replace the three placeholder icons with real PNGs before uploading to Chrome Web Store or Firefox AMO:

- `16.png` — toolbar icon (browser action)
- `48.png` — extensions management page
- `128.png` — Chrome Web Store listing + install dialog

**Recommended sizing tool:** any image editor can export at exact dimensions. Keep square, transparent background preferred.

**CWS requirement:** the 128×128 icon is mandatory and shown prominently in the store listing. The 16 and 48 are used in-browser.

WXT copies these files to the built extension at the paths declared in the generated manifest (`icons`).

> This template ships with placeholder PNGs (or no PNGs — add your own). The The App Discipline vault (sold separately) documents this as an explicit pre-deploy task.
