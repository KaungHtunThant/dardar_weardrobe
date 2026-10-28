import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

async function goToWardrobe(page: Page) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Wardrobe' }).click()
  await expect(page.getByRole('heading', { name: 'Wardrobe', level: 1 })).toBeVisible()
}

const mainScroll = (page: Page) =>
  page.locator('#main').evaluate((el) => ({ top: el.scrollTop, overflow: el.scrollHeight - el.clientHeight }))

test('closet view shows a wall of seven closets without vertical scrolling', async ({ page }) => {
  await goToWardrobe(page)
  await expect(page.getByTestId('closet-tile')).toHaveCount(7)
  expect((await mainScroll(page)).overflow).toBeLessThanOrEqual(0)
})

test('opening a closet swings the doors open onto a draggable rail', async ({ page }) => {
  await goToWardrobe(page)
  await page.getByRole('button', { name: /Open Tops closet/ }).click()

  const stage = page.getByTestId('closet-stage')
  await expect(stage.getByRole('heading', { name: 'Tops' })).toBeVisible()
  await expect(stage.locator('[data-door="left"]')).toHaveClass(/rotateY\(-104deg\)/)
  await expect(stage.getByTestId('rail-item')).toHaveCount(7)

  // Drag the rail to the left: clothes move sideways, the page never scrolls vertically.
  const viewport = stage.getByTestId('rail-viewport')
  const first = stage.getByTestId('rail-item').first()
  const startX = (await first.boundingBox())!.x
  const box = (await viewport.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 12 })
  await page.mouse.up()
  await expect.poll(async () => (await first.boundingBox())!.x).toBeLessThan(startX - 100)

  const scroll = await mainScroll(page)
  expect(scroll.top).toBe(0)
  expect(scroll.overflow).toBeLessThanOrEqual(0)
})

test('the mouse wheel also moves the rail sideways', async ({ page }) => {
  await goToWardrobe(page)
  await page.getByRole('button', { name: /Open Tops closet/ }).click()
  const stage = page.getByTestId('closet-stage')
  const first = stage.getByTestId('rail-item').first()
  await expect(first).toBeVisible()
  const startX = (await first.boundingBox())!.x
  const box = (await stage.getByTestId('rail-viewport').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 120)
  await expect.poll(async () => (await first.boundingBox())!.x).toBeLessThan(startX - 50)
  expect((await mainScroll(page)).top).toBe(0)
})

test('closing the closet and the Back button both return to the wall', async ({ page }) => {
  await goToWardrobe(page)
  await page.getByRole('button', { name: /Open Shoes closet/ }).click()
  await expect(page.getByTestId('closet-stage')).toBeVisible()
  await expect(page.getByTestId('shelf')).toBeVisible()
  await page.getByRole('button', { name: 'All closets' }).click()
  await expect(page.getByTestId('closet-wall')).toBeVisible()

  await page.getByRole('button', { name: /Open Bags closet/ }).click()
  await expect(page.getByTestId('closet-stage')).toBeVisible()
  await page.goBack()
  await expect(page.getByTestId('closet-wall')).toBeVisible()
})

test('list view filters by category and scrolls vertically', async ({ page }) => {
  await goToWardrobe(page)
  await page.getByRole('radio', { name: 'List' }).click()
  await expect(page.getByTestId('item-card')).toHaveCount(33)
  expect((await mainScroll(page)).overflow).toBeGreaterThan(0)

  await page.getByRole('toolbar', { name: 'Filter by category' }).getByRole('button', { name: /Shoes/ }).click()
  await expect(page.getByTestId('item-card')).toHaveCount(4)
  await expect(page).toHaveURL(/filter=shoes/)

  await page.getByRole('toolbar', { name: 'Filter by category' }).getByRole('button', { name: /All/ }).click()
  await expect(page.getByTestId('item-card')).toHaveCount(33)
})

test('the add button floats in both views', async ({ page }) => {
  await goToWardrobe(page)
  const fab = page.getByRole('button', { name: 'Add item' })
  await expect(fab).toBeVisible()
  await page.getByRole('radio', { name: 'List' }).click()
  await page.locator('#main').evaluate((el) => el.scrollTo(0, el.scrollHeight))
  await expect(fab).toBeInViewport()
})
