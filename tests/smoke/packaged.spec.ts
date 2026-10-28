import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'

/** The unpacked build electron-builder leaves next to the installer. */
const executable =
  process.platform === 'win32' ? join('release', 'win-unpacked', 'Dardar Wardrobe.exe') : join('release', 'linux-unpacked', 'dardar-wardrobe')

const photo = { name: 'blouse.png', mimeType: 'image/png', buffer: readFileSync('tests/fixtures/photos/blouse-on-blue.png') }

/** A brand-new user profile, so the app starts as a fresh install would. */
const home = mkdtempSync(join(tmpdir(), 'dardar-smoke-'))

function launch(): Promise<ElectronApplication> {
  return electron.launch({
    executablePath: executable,
    env: { ...process.env, HOME: home, USERPROFILE: home, APPDATA: join(home, 'AppData', 'Roaming'), XDG_CONFIG_HOME: join(home, '.config'), ANTHROPIC_API_KEY: '' },
  })
}

test.skip(!existsSync(executable), `No packaged app at ${executable}; run npm run dist:linux (or dist:win) first.`)
test.afterAll(() => rmSync(home, { recursive: true, force: true }))

test('a fresh install starts empty, removes a real background, styles offline and never stores the API key in plain text', async () => {
  let app = await launch()
  let page = await app.firstWindow()
  const userData = await app.evaluate(({ app }) => app.getPath('userData'))
  const nav = () => page.getByRole('navigation', { name: 'Main' })

  // Empty wardrobe, no demo data.
  await expect(page.getByText('No recommendation yet')).toBeVisible({ timeout: 60_000 })

  // Offline stylist, so nothing calls a real model.
  await nav().getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('radio', { name: /Offline/ }).click()
  if (await page.getByRole('button', { name: 'Save settings' }).isEnabled()) await page.getByRole('button', { name: 'Save settings' }).click()

  // Add a real photo: the bundled model removes the background.
  await nav().getByRole('link', { name: 'Wardrobe' }).click()
  await page.getByRole('radio', { name: 'List' }).click()
  await page.getByRole('toolbar', { name: 'Filter by category' }).getByRole('button', { name: /Tops/ }).click()
  await page.getByRole('button', { name: 'Add item' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add to your wardrobe' })
  await dialog.getByLabel('Choose a photo').setInputFiles(photo)
  await expect(dialog.getByTestId('clean-preview')).toBeVisible({ timeout: 120_000 })
  await expect(dialog.getByText("We couldn't remove the background")).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Save to wardrobe' }).click()
  await dialog.getByLabel('Name').fill('Blush Blouse')
  await dialog.getByLabel('Colours').fill('blush')
  await dialog.getByRole('button', { name: 'Save to wardrobe' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByTestId('item-card')).toHaveCount(1)

  // Style it offline.
  await nav().getByRole('link', { name: 'Studio' }).click()
  await page.getByRole('button', { name: 'Wear Blush Blouse' }).click()
  await page.getByRole('button', { name: 'Generate & rate' }).click()
  await expect(page.getByTestId('rating-card').getByTestId('score')).toHaveText(/^\d{1,2}\/10$/)

  // The API key: encrypted by the OS keychain when there is one, refused (with a way out) when there isn't.
  await nav().getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('radio', { name: /Anthropic API/ }).click()
  const { keyStorage } = await page.evaluate(() => fetch('/api/settings').then((r) => r.json() as Promise<{ keyStorage: string }>))
  expect(['keychain', 'unavailable']).toContain(keyStorage)
  const keyFile = join(userData, 'anthropic-key.bin')
  if (keyStorage === 'keychain') {
    await page.getByLabel('Anthropic API key').fill('sk-ant-smoke-test-9876')
    await page.getByRole('button', { name: 'Save settings' }).click()
    await expect(page.getByTestId('key-status')).toContainText('9876')
  } else {
    await expect(page.getByLabel('Anthropic API key')).toBeDisabled()
    await expect(page.getByText(/no system keychain/)).toBeVisible()
  }
  await page.getByRole('radio', { name: /Offline/ }).click()
  if (await page.getByRole('button', { name: 'Save settings' }).isEnabled()) await page.getByRole('button', { name: 'Save settings' }).click()
  await app.close()

  // Never stored as plain text.
  if (keyStorage === 'keychain') expect(readFileSync(keyFile).toString('latin1')).not.toContain('sk-ant')
  else expect(existsSync(keyFile)).toBe(false)

  // Everything is still there after a restart.
  app = await launch()
  page = await app.firstWindow()
  await nav().getByRole('link', { name: 'Wardrobe' }).click()
  await page.getByRole('radio', { name: 'List' }).click()
  await expect(page.getByTestId('item-card')).toContainText('Blush Blouse')
  if (keyStorage === 'keychain') {
    await nav().getByRole('link', { name: 'Settings' }).click()
    await page.getByRole('radio', { name: /Anthropic API/ }).click()
    await expect(page.getByTestId('key-status')).toContainText('9876')
  }
  await app.close()
})
