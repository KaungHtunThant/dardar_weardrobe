import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

async function openStudio(page: Page) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Studio' }).click()
  await expect(page.getByRole('heading', { name: 'Style Studio' })).toBeVisible()
}

const figureScale = (page: Page) => page.getByTestId('figure').evaluate((el) => Number(el.dataset.scale))
const figureTop = (page: Page) => page.getByTestId('figure').evaluate((el) => el.getBoundingClientRect().top)

test('dress the form from the wardrobe panel, Create-A-Sim style', async ({ page }) => {
  await openStudio(page)
  await expect(page.getByTestId('panel-grid').getByRole('button', { name: /^(Wear|Take off) / })).toHaveCount(33)

  await page.getByRole('button', { name: 'Wear White Linen Tee' }).click()
  await page.getByRole('button', { name: 'Wear Straight Blue Jeans' }).click()
  await expect(page.getByTestId('worn-piece')).toHaveCount(2)
  await expect(page.locator('[data-testid="worn-piece"][data-slot="torso"]')).toBeVisible()

  // Same slot swaps; a dress takes the separates off.
  await page.getByRole('button', { name: 'Wear Black Fitted Tee' }).click()
  await expect(page.locator('[data-slot="torso"]')).toHaveAttribute('aria-label', /Black Fitted Tee/)
  await page.getByRole('button', { name: 'Wear Sage Slip Dress' }).click()
  await expect(page.getByTestId('worn-piece')).toHaveCount(1)
  await page.getByRole('button', { name: 'Take off Sage Slip Dress' }).click()
  await expect(page.getByTestId('worn-piece')).toHaveCount(0)
})

test('clicking a piece on the form filters the wardrobe to its category', async ({ page }) => {
  await openStudio(page)
  await page.getByRole('button', { name: 'Wear Red Pumps' }).click()
  await page.locator('[data-testid="worn-piece"][data-slot="feet"]').click()
  await expect(page.getByRole('tab', { name: 'Shoes' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('panel-grid').getByRole('button', { name: /^(Wear|Take off) / })).toHaveCount(4)

  // AI placeholders filter too.
  await page.getByRole('button', { name: /AI picks bags/ }).click()
  await expect(page.getByTestId('panel-grid').getByRole('button', { name: /^(Wear|Take off) / })).toHaveCount(3)
})

test('zoom in/out and scroll up/down on the dress form', async ({ page }) => {
  await openStudio(page)
  const base = await figureScale(page)
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect(page.getByTestId('zoom-label')).toHaveText('150%')
  expect(await figureScale(page)).toBeGreaterThan(base)

  const box = (await page.getByTestId('dress-form').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  const top = await figureTop(page)
  await page.mouse.wheel(0, 400)
  await expect.poll(() => figureTop(page)).toBeLessThan(top)
  expect(await page.locator('#main').evaluate((el) => el.scrollTop)).toBe(0)

  await page.getByRole('button', { name: 'Fit to screen' }).click()
  await expect(page.getByTestId('zoom-label')).toHaveText('100%')
})

test('generate fills the gaps on the form, rates brutally, and a fix re-rates', async ({ page }) => {
  await openStudio(page)
  await page.getByRole('button', { name: 'Wear White Linen Tee' }).click()
  await page.getByRole('button', { name: 'Wear Burgundy A-Line Skirt' }).click()
  await page.getByRole('button', { name: 'AI fills Bags' }).click()
  await expect(page.getByRole('button', { name: 'AI fills Tops' })).toBeDisabled()
  await expect(page.getByTestId('ai-slot')).toHaveCount(1)
  await page.getByPlaceholder(/Describe the vibe/).fill('weekend coffee')

  await page.getByRole('button', { name: 'Generate & rate' }).click()
  const card = page.getByTestId('rating-card')
  await expect(card.getByTestId('score')).toHaveText(/^\d{1,2}\/10$/)
  await expect(page.getByRole('tab', { name: 'Verdict' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('[data-testid="worn-piece"][data-ai="true"]')).toHaveCount(1)
  await expect(page.getByTestId('look-title')).not.toBeEmpty()

  const before = await page.getByTestId('worn-piece').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  await card.getByRole('button', { name: 'Try it' }).first().click()
  await expect
    .poll(() => page.getByTestId('worn-piece').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label'))))
    .not.toEqual(before)

  // Changing the outfit afterwards marks the verdict as stale.
  await page.getByRole('tab', { name: 'Wardrobe' }).click()
  await page.getByRole('button', { name: 'Wear Straw Sun Hat' }).click()
  await expect(page.getByText('outfit changed since it was rated')).toBeVisible()

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home' }).click()
  await expect(page.locator('section[aria-labelledby="recent-title"] [data-testid="look-card"]').first()).toContainText('/10')
})

test('the AI can dress the whole form from nothing; clear starts over', async ({ page }) => {
  await openStudio(page)
  await page.getByRole('button', { name: 'Generate & rate' }).click()
  await expect(page.getByTestId('rating-card')).toBeVisible()
  await expect(page.locator('[data-testid="worn-piece"][data-ai="false"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Clear outfit' }).click()
  await expect(page.getByTestId('worn-piece')).toHaveCount(0)
  await expect(page.getByTestId('ai-slot')).toHaveCount(4)
})

test('generate is disabled with nothing worn and no AI categories', async ({ page }) => {
  await openStudio(page)
  for (const c of ['Tops', 'Bottoms', 'Shoes', 'Bags']) await page.getByRole('button', { name: `AI fills ${c}` }).click()
  await expect(page.getByRole('button', { name: 'Generate & rate' })).toBeDisabled()
})
