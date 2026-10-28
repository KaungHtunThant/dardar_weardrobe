import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  ssr: false,
  devtools: { enabled: false },
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
    clientBundle: { scan: true },
  },
  fonts: {
    families: [
      { name: 'Cormorant Garamond', provider: 'google', weights: [400, 500, 600] },
      { name: 'DM Sans', provider: 'google', weights: [400, 500, 600] },
    ],
  },
  runtimeConfig: {
    public: {
      gateway: 'mock',
    },
  },
})
