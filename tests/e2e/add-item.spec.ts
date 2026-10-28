import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

const svgPhoto = {
  name: 'beret.svg',
  mimeType: 'image/svg+xml',
  buffer: readFileSync('public/garments/straw-hat.svg'),
}
/** A real photo: a garment on a blue background (runs the local background-removal model). */
const realPhoto = {
  name: 'blouse.png',
  mimeType: 'image/png',
  buffer: readFileSync('tests/fixtures/photos/blouse-on-blue.png'),
}

async function addBeret(page: Page, photo = svgPhoto) {
  await page.getByRole('button', { name: 'Add item' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add to your wardrobe' })
  await dialog.getByLabel('Choose a photo').setInputFiles(photo)
  if (photo === realPhoto) await expect(dialog.getByText('Removing background…')).toBeVisible()
  await expect(dialog.getByTestId('clean-preview')).toBeVisible({ timeout: 60_000 })

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

  await addBeret(page, realPhoto)

  await expect(page.getByTestId('item-card')).toHaveCount(5)
  await expect(page.getByTestId('item-card').first()).toContainText('Pink Beret')
  // The stored clean image is a background-free PNG served by the API.
  await expect(page.getByTestId('item-card').first().locator('img')).toHaveAttribute('src', /^\/api\/images\/[a-f0-9-]+\.png$/)

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
