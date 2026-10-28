import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' })

test('open a piece from the list, edit it, and it moves to its new closet', async ({ page }) => {
  await nav(page).getByRole('link', { name: 'Wardrobe' }).click()
  await page.getByRole('radio', { name: 'List' }).click()
  await page.getByRole('button', { name: 'Open White Linen Tee' }).click()

  const sheet = page.getByRole('dialog', { name: 'White Linen Tee' })
  await expect(sheet.getByTestId('sheet-image').locator('img')).toBeVisible()
  await expect(sheet).toContainText('Tops')
  await sheet.getByRole('button', { name: 'Edit details' }).click()
  await sheet.getByLabel('Name').fill('Linen Overshirt')
  await sheet.getByRole('button', { name: 'Outerwear' }).click()
  await sheet.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('dialog', { name: 'Linen Overshirt' })).toContainText('Outerwear')

  // Back closes the sheet.
  await page.goBack()
  await expect(page.getByRole('dialog')).toBeHidden()

  await page.getByRole('radio', { name: 'Closet' }).click()
  await page.getByRole('button', { name: /Open Outerwear closet, 5 pieces/ }).click()
  await expect(page.getByTestId('rail-item').filter({ hasText: 'Linen Overshirt' })).toHaveCount(1)
})

test('delete a piece from its closet: it leaves the wardrobe and its looks', async ({ page }) => {
  await nav(page).getByRole('link', { name: 'Wardrobe' }).click()
  await page.getByRole('button', { name: /Open Accessories closet/ }).click()
  await page.getByRole('button', { name: 'Open Gold Pendant Necklace' }).click()

  const sheet = page.getByRole('dialog', { name: 'Gold Pendant Necklace' })
  await expect(sheet.getByTestId('looks-count')).toHaveText('In 2 looks')
  await sheet.getByRole('button', { name: 'Delete' }).click()
  const confirm = page.getByRole('dialog', { name: 'Delete Gold Pendant Necklace?' })
  await expect(confirm).toContainText("It's in 2 looks")
  await confirm.getByRole('button', { name: 'Delete piece' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await expect(page.getByTestId('rail-item').filter({ hasText: 'Gold Pendant Necklace' })).toHaveCount(0)
  await nav(page).getByRole('link', { name: 'Home' }).click()
  await expect(page.getByRole('img', { name: 'Gold Pendant Necklace' })).toHaveCount(0)
})

test('open piece details from the Studio wardrobe panel', async ({ page }) => {
  await nav(page).getByRole('link', { name: 'Studio' }).click()
  await page.getByRole('tab', { name: 'Shoes' }).click()
  await page.getByRole('button', { name: 'Details for Red Pumps' }).click()
  await expect(page.getByRole('dialog', { name: 'Red Pumps' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  // The tile itself still wears the piece.
  await page.getByRole('button', { name: 'Wear Red Pumps' }).click()
  await expect(page.locator('[data-testid="worn-piece"][data-slot="feet"]')).toBeVisible()
})
