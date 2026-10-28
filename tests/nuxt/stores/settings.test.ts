import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsStore } from '~/stores/settings'
import { setupTestGateway } from '../helpers'

describe('settings store', () => {
  let gateway: ReturnType<typeof setupTestGateway>
  beforeEach(() => {
    gateway = setupTestGateway()
  })

  it('loads and updates settings', async () => {
    const store = useSettingsStore()
    await store.load()
    expect(store.view?.advisor).toBe('offline')
    await store.update({ advisor: 'claude-api', apiKey: 'sk-1234' })
    expect(store.view?.advisor).toBe('claude-api')
    expect(store.view?.apiKey.last4).toBe('1234')
  })

  it('keeps the previous view and reports errors', async () => {
    vi.spyOn(gateway, 'updateSettings').mockRejectedValueOnce(new Error('nope'))
    const store = useSettingsStore()
    await store.load()
    expect(await store.update({ advisor: 'claude-cli' })).toBe(false)
    expect(store.error).toBe('nope')
    expect(store.view?.advisor).toBe('offline')
  })
})
