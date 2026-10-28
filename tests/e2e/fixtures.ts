import { test as base, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'

/** Drives the real Electron shell pointed at the e2e Nuxt dev server. */
export const test = base.extend<{ app: ElectronApplication; page: Page }>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixture signature
  app: async ({}, use) => {
    const app = await electron.launch({
      args: ['.'],
      env: { ...process.env, DARDAR_URL: 'http://localhost:3123' } as Record<string, string>,
    })
    await use(app)
    await app.close()
  },
  page: async ({ app }, use) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('networkidle')
    // Each test starts from fresh seed data.
    const res = await fetch('http://localhost:3123/api/dev/reset', { method: 'POST' })
    if (!res.ok) throw new Error(`Reset failed (${res.status}). Is a dev server without NUXT_ALLOW_RESET on :3123?`)
    await page.reload()
    await page.waitForLoadState('networkidle')
    await use(page)
  },
})

export { expect } from '@playwright/test'
