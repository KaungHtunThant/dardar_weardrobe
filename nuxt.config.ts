import tailwindcss from '@tailwindcss/vite'
// sharp's native module must be loaded by the main thread before a worker thread loads it,
// and `nuxt dev` runs the API (which uses sharp) in a worker thread.
import 'sharp'

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  ssr: false,
  devtools: { enabled: false },
  // The local API has no authentication: never expose the dev server to the network.
  devServer: { host: '127.0.0.1' },
  nitro: { rollupConfig: { external: ['node:sqlite'] } },
  modules: ['@pinia/nuxt', '@nuxt/icon', '@nuxt/fonts', '@nuxt/eslint', '@nuxt/test-utils/module'],
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },
  // Only .vue files are components; logic lives in app/services (see CLAUDE.md).
  components: [{ path: '~/components', extensions: ['vue'], pathPrefix: true }],
  app: {
    head: {
      title: 'Dardar Wardrobe',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
  icon: {
    serverBundle: 'local',
    // The scan reads templates only; icons chosen in .ts code (the weather's) are listed here.
    clientBundle: {
      scan: true,
      icons: [
        'lucide:sun',
        'lucide:cloud-sun',
        'lucide:cloud',
        'lucide:cloud-fog',
        'lucide:cloud-drizzle',
        'lucide:cloud-rain',
        'lucide:snowflake',
        'lucide:cloud-lightning',
      ],
    },
  },
  fonts: {
    families: [
      { name: 'Cormorant Garamond', provider: 'google', weights: [400, 500, 600] },
      { name: 'DM Sans', provider: 'google', weights: [400, 500, 600] },
    ],
  },
  runtimeConfig: {
    // Server-only; override with NUXT_DATA_DIR / NUXT_DEMO_SEED / NUXT_ALLOW_RESET / NUXT_DEFAULT_ADVISOR / NUXT_WEATHER.
    dataDir: '.data',
    demoSeed: true,
    allowReset: false,
    // First-run stylist: 'auto' = Claude CLI if installed, else API if a key is set, else offline.
    defaultAdvisor: 'auto',
    // Forecasts and city search: 'open-meteo' (live) or 'demo' (offline stand-ins; e2e uses NUXT_WEATHER=demo).
    weather: 'open-meteo',
    public: {
      // 'http' = local Nitro API; 'mock' = backend-free prototype (NUXT_PUBLIC_GATEWAY=mock).
      gateway: 'http',
    },
  },
})
