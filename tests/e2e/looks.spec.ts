import { test, expect } from './fixtures'

test('browse looks, filter favourites, reopen one in the Studio, delete another', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Main' })
  // Make a rated look first.
  await nav.getByRole('link', { name: 'Studio' }).click()
  await page.getByRole('button', { name: 'Generate & rate' }).click()
  await expect(page.getByTestId('rating-card')).toBeVisible()
  const title = (await page.getByTestId('look-title').textContent())!.trim()

  await nav.getByRole('link', { name: 'Looks' }).click()
  const cards = page.getByTestId('look-card')
  // 6 demo looks + today's daily pick (styled when Home opened) + the one just generated.
  await expect(cards).toHaveCount(8)
  await expect(cards.first()).toContainText(title)

  await page.getByRole('toolbar', { name: 'Filter looks' }).getByRole('button', { name: /Favourites/ }).click()
  await expect(cards).toHaveCount(3)
  await page.getByRole('toolbar', { name: 'Filter looks' }).getByRole('button', { name: /^All/ }).click()

  await page.getByRole('radio', { name: 'Best' }).click()
  await expect(page).toHaveURL(/sort=score-desc/)

  await page.getByRole('button', { name: `Open ${title} in the Studio` }).click()
  await expect(page).toHaveURL(/\/studio\?look=/)
  await expect(page.getByRole('tab', { name: 'Verdict' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('rating-card')).toBeVisible()
  await expect(page.getByTestId('worn-piece').first()).toBeVisible()

  await nav.getByRole('link', { name: 'Looks' }).click()
  await page.getByRole('button', { name: 'Delete Date Night' }).click()
  await page.getByRole('dialog', { name: 'Delete Date Night?' }).getByRole('button', { name: 'Delete look' }).click()
  await expect(cards).toHaveCount(7)
  await expect(page.getByText('Date Night')).toHaveCount(0)
})
