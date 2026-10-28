import { defineConfig } from '@playwright/test'

/** Smoke test of the packaged app (run `npm run dist:linux` / `dist:win` first). No dev server. */
export default defineConfig({
  testDir: 'tests/smoke',
  timeout: 180_000,
  workers: 1,
  reporter: 'list',
})
