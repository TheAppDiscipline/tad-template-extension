import { defineConfig } from 'wxt'

// Doc: https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: '.',
  manifestVersion: 3,
  manifest: {
    name: 'Discipline Loop Extension Template',
    description: 'Browser extension scaffolded from tad-template-extension',
    // version is read from package.json by WXT
    permissions: [
      'storage',
      // 'activeTab',         // uncomment if popup needs current tab access
      // 'tabs',              // only if you need tab enumeration (review CWS carefully)
      // 'scripting',         // only if you inject scripts programmatically
    ],
    host_permissions: [
      // 'https://*.your-sidecar-domain.com/*',
    ],
    action: {
      default_title: 'Discipline Loop Extension',
      default_popup: 'popup.html',
    },
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
  },
  runner: {
    // Opens a fresh browser instance on `wxt` dev command
    disabled: false,
  },
  vite: () => ({
    // Add Vite options here if needed (plugins, aliases, etc.)
  }),
})
