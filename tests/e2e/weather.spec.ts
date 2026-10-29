import { test, expect } from './fixtures'

// The e2e server runs the offline demo weather (NUXT_WEATHER=demo): this computer "is" in Paris.

test('first launch: Dardar suggests your city, and today dresses for its weather', async ({ page }) => {
  const welcome = page.getByTestId('stylist-welcome')
  await expect(welcome.getByTestId('welcome-place')).toHaveText('Paris, France')
  await welcome.getByRole('button', { name: 'Lovely' }).click()
  await expect(welcome).toBeHidden()
  await expect(page.getByTestId('today-weather')).toContainText('in Paris, France')
  await expect(page.getByTestId('ask-for-city')).toBeHidden()
})

test('change the city in Settings; Home and the Studio follow its weather', async ({ page }) => {
  await page.getByTestId('stylist-welcome').getByRole('button', { name: 'Not here?' }).click()
  await page.getByTestId('stylist-welcome').getByLabel('Search for your city').fill('Lond')
  await page.getByRole('list', { name: 'Cities' }).getByRole('button', { name: /London/ }).click()
  await expect(page.getByTestId('welcome-place')).toHaveText('London, United Kingdom')
  await page.getByRole('button', { name: 'Lovely' }).click()
  await expect(page.getByTestId('today-weather')).toContainText('in London, United Kingdom')

  const nav = page.getByRole('navigation', { name: 'Main' })
  await nav.getByRole('link', { name: 'Settings' }).click()
  const city = page.getByTestId('settings-location')
  await expect(city.getByTestId('location-label')).toHaveText('London, United Kingdom')
  await city.getByRole('button', { name: 'Change' }).click()
  await page.getByLabel('Search for your city').fill('Tokyo')
  await page.getByRole('list', { name: 'Cities' }).getByRole('button', { name: /Tokyo/ }).click()
  await expect(city.getByTestId('location-label')).toHaveText('Tokyo, Japan')

  // Today's pick was styled for London: it is styled again for Tokyo.
  await nav.getByRole('link', { name: 'Home' }).click()
  await expect(page.getByTestId('today-weather')).toContainText('in Tokyo, Japan')

  await nav.getByRole('link', { name: 'Studio' }).click()
  const toggle = page.getByTestId('studio-weather')
  await expect(toggle).toContainText('Tokyo, Japan')
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('button', { name: /Generate & rate/ }).click()
  await expect(page.getByTestId('verdict-weather')).toContainText('in Tokyo, Japan')

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await page.getByRole('button', { name: /Generate & rate/ }).click()
  await expect(page.getByTestId('look-title')).toBeVisible()
  await expect(page.getByTestId('verdict-weather')).toBeHidden()
})

test('remove the city: looks stop following the weather', async ({ page }) => {
  await page.getByRole('button', { name: 'Lovely' }).click()
  const nav = page.getByRole('navigation', { name: 'Main' })
  await nav.getByRole('link', { name: 'Settings' }).click()
  await page.getByTestId('settings-location').getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByTestId('location-label')).toHaveText(/No city yet/)
  await nav.getByRole('link', { name: 'Studio' }).click()
  await expect(page.getByTestId('studio-ask-for-city')).toBeVisible()
})
