import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    /**
     * Installable, with an offline *shell* and nothing more.
     *
     * The precache is the build output and the icons — no runtime caching of
     * `/api` at all. That is the whole security argument for shipping this on
     * a phone that sits on a gym counter: after a logout there is nothing left
     * on the device to find, because no member ever reached the cache. It also
     * sidesteps the harder half of offline-first, which is what to do with a
     * payment recorded against stale data.
     *
     * So offline buys exactly one thing: the app opens, and every route
     * renders its own shell instead of the browser's dinosaur.
     */
    VitePWA({
      registerType: 'autoUpdate',
      // The manifest is a real file in public/, so the plugin should link it
      // rather than synthesise a second one from config.
      manifest: false,
      // No `includeAssets`: everything in public/ is already emitted into the
      // build, so the glob below catches it. Listing the icons again only
      // duplicated them in the precache manifest.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // The 512px source the PNGs were traced from. Shipping it would cache
        // a file nothing requests.
        globIgnores: ['**/app-icon.svg'],
        // Deep links have to work offline: any in-scope navigation falls back
        // to the cached shell, and the SPA router takes it from there.
        navigateFallback: '/index.html',
        // Except the API — a navigation fallback on those would answer a data
        // request with a page, which reads as a parse error rather than as
        // being offline.
        navigateFallbackDenylist: [/^\/api\//],
        // Old hashed bundles are dead weight on a phone once a deploy lands.
        cleanupOutdatedCaches: true,
      },
      // A service worker in dev serves yesterday's bundle and costs an hour
      // before anyone suspects it.
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Demo tunnels only. Vite rejects unknown Host headers by default, which is
    // what stops a stranger's domain from pointing at this dev server; keeping
    // the list to the one tunnel domain preserves that for everything else.
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
})
