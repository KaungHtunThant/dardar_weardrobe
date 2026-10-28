import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

const photo = {
  name: 'beret.svg',
  mimeType: 'image/svg+xml',
  buffer: readFileSync('public/garments/straw-hat.svg'),
}

async function addBeret(page: Page) {
  await page.getByRole('button', { name: 'Add item' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add to your wardrobe' })
  await dialog.getByLabel('Choose a photo').setInputFiles(photo)
  await expect(dialog.getByText('Removing background…')).toBeVisible()
  await expect(dialog.getByTestId('clean-preview')).toBeVisible()

  await dialog.getByRole('button', { name: 'Save to wardrobe' }).click()
  await expect(dialog.getByText('Give this piece a name')).toBeVisible()

  await dialog.getByLabel('Name').fill('Pink Beret')
  await dialog.getByLabel('Colours').fill('pink')
  await dialog.getByRole('button', { name: 'Autumn' }).click()
  await dialog.getByRole('button', { name: 'Save to wardrobe' }).click()
  await expect(dialog).toBeHidden()
}

test('adding an item from the list view shows it in the list and in its closet', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Wardrobe' }).click()
  await page.getByRole('radio', { name: 'List' }).click()
  await page.getByRole('toolbar', { name: 'Filter by category' }).getByRole('button', { name: /Accessories/ }).click()
  await expect(page.getByTestId('item-card')).toHaveCount(4)

  await addBeret(page)

  await expect(page.getByTestId('item-card')).toHaveCount(5)
  await expect(page.getByTestId('item-card').first()).toContainText('Pink Beret')

  await page.getByRole('radio', { name: 'Closet' }).click()
  await page.getByRole('button', { name: /Open Accessories closet, 5 pieces/ }).click()
  await expect(page.getByTestId('rail-item').first()).toContainText('Pink Beret')
})

test('an added item survives a reload', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Wardrobe' }).click()
  await page.getByRole('button', { name: /Open Accessories closet/ }).click()
  await addBeret(page)
  await expect(page.getByTestId('rail-item')).toHaveCount(5)
  await page.reload()
  await expect(page.getByTestId('rail-item').first()).toContainText('Pink Beret')
})
