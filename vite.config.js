import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'manifest.webmanifest'],
      manifest: {
        name: 'Anas Hadi Poultry Services',
        short_name: 'Anas Hadi',
        description: 'Poultry supply store management — inventory, farms, clients, dispatches, cash and Roznamcha.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#06191B',
        theme_color: '#0F5257',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell: precache built JS/CSS/HTML/fonts/icons so the app loads
        // instantly on phone and continues to render UI even if the network drops.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
        // The app is one bundle and it passed workbox's 2 MiB default, which fails
        // the build outright. Raised so the shell stays fully precached.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Supabase API calls are intentionally NOT cached — finances must be live.
        // Anything else from the same origin (the built app shell) is precached above.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        // Don't try to claim API requests; let them go straight to Supabase.
        runtimeCaching: [],
      },
      devOptions: {
        // Keep the SW off during `npm run dev` so HMR isn't fighting cache.
        enabled: false,
      },
    }),
  ],
})
