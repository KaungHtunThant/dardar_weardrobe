import { test, expect } from './fixtures'

test('choose the stylist; the Studio shows who styles', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(page.getByRole('radio', { name: /Offline/ })).toHaveAttribute('aria-checked', 'true')

  await page.getByRole('radio', { name: /Anthropic API/ }).click()
  await expect(page.getByTestId('settings-warning')).toContainText('API key')
  await page.getByLabel('Anthropic API key').fill('sk-ant-e2e-test-1234')
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByRole('status')).toHaveText('Saved')
  await expect(page.getByTestId('key-status')).toContainText('1234')
  await expect(page.getByLabel('Anthropic API key')).toHaveValue('')

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Studio' }).click()
  await expect(page.getByTestId('stylist-label')).toContainText('Anthropic API')

  // Back to offline so nothing calls a real model.
  await page.getByRole('link', { name: 'change' }).click()
  await page.getByRole('radio', { name: /Offline/ }).click()
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByRole('status')).toHaveText('Saved')
})

test('start fresh: clearing the wardrobe empties every page but keeps settings', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Main' })
  await nav.getByRole('link', { name: 'Settings' }).click()

  // Cancelling keeps everything.
  await page.getByRole('button', { name: 'Clear wardrobe…' }).click()
  await page.getByRole('button', { name: 'Keep my wardrobe' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  await page.getByRole('button', { name: 'Clear wardrobe…' }).click()
  await expect(page.getByRole('dialog', { name: 'Clear your wardrobe?' })).toBeVisible()
  await page.getByRole('button', { name: 'Delete everything' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('status')).toContainText('fresh')

  await nav.getByRole('link', { name: 'Wardrobe' }).click()
  await expect(page.locator('main header').getByText('0 pieces')).toBeVisible()
  await expect(page.getByTestId('closet-tile').first()).toContainText('0 pieces')
  await nav.getByRole('link', { name: 'Home' }).click()
  await expect(page.getByText('No recommendation yet')).toBeVisible()
  await expect(page.getByText('No favourites yet')).toBeVisible()

  // Still empty after a reload (nothing comes back from the server).
  await page.reload()
  await expect(page.getByText('No recommendation yet')).toBeVisible()
  await nav.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('radio', { name: /Offline/ })).toHaveAttribute('aria-checked', 'true')
})
