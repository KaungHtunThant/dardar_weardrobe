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

/** Adds a photo: it is prepared in the background, then reviewed from the upload tray and saved. */
async function addBeret(page: Page, photo = svgPhoto) {
  await page.getByRole('button', { name: 'Add item' }).click()
  const adding = page.getByRole('dialog', { name: 'Add to your wardrobe' })
  await adding.getByLabel('Choose photos').setInputFiles(photo)
  // The dialog closes at once; the tray follows the photo while you carry on.
  await expect(adding).toBeHidden()
  const tray = page.getByTestId('upload-tray')
  await expect(tray).toContainText('1 ready to add', { timeout: 90_000 })
  await tray.click()
  await page.getByTestId('upload-tray-panel').getByRole('button', { name: 'Review' }).click()

  const dialog = page.getByRole('dialog', { name: 'Add to your wardrobe' })
  await expect(dialog.getByTestId('clean-preview')).toBeVisible()
  await dialog.getByRole('button', { name: 'Save to wardrobe' }).click()
  await expect(dialog.getByText('Give this piece a name')).toBeVisible()

  await dialog.getByLabel('Name').fill('Pink Beret')
  await dialog.getByLabel('Colours').fill('pink')
  await dialog.getByRole('button', { name: 'Autumn' }).click()
  await dialog.getByRole('button', { name: 'Save to wardrobe' }).click()
  await expect(dialog).toBeHidden()
  await expect(tray).toBeHidden()
}

test('adding an item from the list view shows it in the list and in its closet', async ({ page }) => {
  test.setTimeout(150_000) // the first real photo loads the local models
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

test('photos keep being prepared while you browse elsewhere', async ({ page }) => {
  test.setTimeout(150_000)
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Wardrobe' }).click()
  await page.getByRole('button', { name: 'Add item' }).click()
  await page.getByRole('dialog', { name: 'Add to your wardrobe' }).getByLabel('Choose photos').setInputFiles([realPhoto, svgPhoto])
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Looks' }).click()
  const tray = page.getByTestId('upload-tray')
  await expect(tray).toContainText(/Preparing|ready to add/)
  await expect(tray).toContainText('2 ready to add', { timeout: 90_000 })
  await tray.click()
  await page.getByTestId('upload-tray-panel').getByRole('button', { name: 'Discard' }).first().click()
  await expect(tray).toContainText('1 ready to add')
})

test('an added item survives a reload', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Wardrobe' }).click()
  await page.getByRole('button', { name: /Open Accessories closet/ }).click()
  await addBeret(page)
  await expect(page.getByTestId('rail-item')).toHaveCount(5)
  await page.reload()
  await expect(page.getByTestId('rail-item').first()).toContainText('Pink Beret')
})
