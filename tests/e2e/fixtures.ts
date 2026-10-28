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
    await page.waitForLoadState('domcontentloaded')
    // Each test starts from fresh seed data.
    await page.evaluate(() => indexedDB.deleteDatabase('dardar-wardrobe'))
    await page.reload()
    await use(page)
  },
})

export { expect } from '@playwright/test'
