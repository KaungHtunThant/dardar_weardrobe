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
