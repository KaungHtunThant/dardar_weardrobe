import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  webServer: {
    // A throwaway data folder; tests reset it to the demo seed via POST /api/dev/reset.
    command: 'rm -rf .data-e2e && NUXT_DATA_DIR=.data-e2e NUXT_ALLOW_RESET=true NUXT_DEMO_SEED=true NUXT_DEFAULT_ADVISOR=offline ANTHROPIC_API_KEY= npx nuxt dev --port 3123',
    url: 'http://localhost:3123',
    timeout: 180_000,
    reuseExistingServer: true,
  },
})
