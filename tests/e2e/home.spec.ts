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

test('home lists what the wardrobe is missing and can ask again', async ({ page }) => {
  const section = page.getByTestId('missing-pieces')
  await expect(section.getByRole('heading', { name: 'What your wardrobe is missing' })).toBeVisible()
  const blazer = section.getByTestId('missing-piece').filter({ hasText: 'Tailored Blazer' })
  await expect(blazer).toBeVisible()
  await expect(blazer.getByRole('list', { name: 'Wear the Tailored Blazer with' }).getByRole('img').first()).toBeVisible()
  await section.getByRole('button', { name: 'Ask Dardar again' }).click()
  await expect(section.getByRole('button', { name: 'Ask Dardar again' })).toBeEnabled()
  await expect(blazer).toBeVisible()
})
