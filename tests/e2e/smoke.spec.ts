import { test, expect } from './fixtures'

test('electron window shows the app', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Dardar Wardrobe' })).toBeVisible()
})
