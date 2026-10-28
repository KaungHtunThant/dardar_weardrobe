import { test, expect } from './fixtures'

test('home shows the three sections', async ({ page }) => {
  await expect(page.getByText("Today's recommendation")).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Recently styled' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Favourite looks' })).toBeVisible()
})

test('favouriting a recent look adds it to favourite looks', async ({ page }) => {
  const favourites = page.locator('section[aria-labelledby="favourites-title"] [data-testid="look-card"]')
  await expect(favourites.first()).toBeVisible()
  const before = await favourites.count()
  await page.getByRole('button', { name: 'Add Date Night to favourites' }).first().click()
  await expect(favourites).toHaveCount(before + 1)
})
