import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  webServer: {
    command: 'npx nuxt dev --port 3123',
    url: 'http://localhost:3123',
    timeout: 180_000,
    reuseExistingServer: true,
  },
})
