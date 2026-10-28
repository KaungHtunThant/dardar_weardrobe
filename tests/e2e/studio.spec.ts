import { test, expect } from './fixtures'

test('mix your picks with AI picks, get a brutal rating, apply a fix', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Studio' }).click()
  await expect(page.getByRole('heading', { name: 'Style Studio' })).toBeVisible()

  // Pick a top and a skirt yourself; the AI keeps shoes and bags, and you switch off bags.
  await page.getByRole('button', { name: 'Pick White Linen Tee' }).click()
  await page.getByRole('tab', { name: /Bottoms/ }).click()
  await page.getByRole('button', { name: 'Pick Burgundy A-Line Skirt' }).click()
  await page.getByRole('button', { name: 'AI fills Bags' }).click()
  await expect(page.getByRole('button', { name: 'AI fills Tops' })).toBeDisabled()
  await expect(page.getByTestId('ai-slot')).toHaveCount(1)
  await page.getByLabel(/Describe the vibe/).fill('weekend coffee')

  await page.getByRole('button', { name: 'Generate & rate' }).click()
  await expect(page.getByText('Styling… and judging')).toBeVisible()

  const card = page.getByTestId('rating-card')
  await expect(card.getByTestId('score')).toHaveText(/^\d{1,2}\/10$/)
  await expect(card.getByTestId('verdict')).not.toBeEmpty()
  const look = page.getByTestId('result-look')
  await expect(look.locator('li[data-ai="true"]')).toHaveCount(1)
  await expect(look.locator('li[data-ai="false"]')).toHaveCount(2)

  // Take the advice: the look is re-rated with the swap applied.
  const before = await look.locator('li').allTextContents()
  await card.getByRole('button', { name: 'Try it' }).first().click()
  await expect.poll(() => look.locator('li').allTextContents()).not.toEqual(before)
  await expect(look.locator('li[data-ai="true"]')).toHaveCount(0)

  // Generated looks show up on Home, newest first, with their score.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home' }).click()
  await expect(page.locator('section[aria-labelledby="recent-title"] [data-testid="look-card"]').first()).toContainText('/10')
})

test('the AI can style a whole look from nothing', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Studio' }).click()
  await page.getByRole('button', { name: 'Generate & rate' }).click()
  await expect(page.getByTestId('rating-card')).toBeVisible()
  await expect(page.getByTestId('result-look').locator('li[data-ai="false"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Start fresh' }).click()
  await expect(page.getByTestId('ai-slot')).toHaveCount(4)
})

test('generate is disabled with nothing picked and no AI categories', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Studio' }).click()
  for (const c of ['Tops', 'Bottoms', 'Shoes', 'Bags']) await page.getByRole('button', { name: `AI fills ${c}` }).click()
  await expect(page.getByRole('button', { name: 'Generate & rate' })).toBeDisabled()
})
