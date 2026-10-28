import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import SettingsPage from '~/pages/settings.vue'
import { setupTestGateway } from '../helpers'

describe('settings page', () => {
  let warn: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    setupTestGateway()
    warn = vi.spyOn(console, 'warn')
  })
  afterEach(() => {
    expect(warn.mock.calls.flat().join(' ')).not.toMatch(/Failed to resolve component/)
    warn.mockRestore()
  })

  it('switches to the API, shows the key field, and saves', async () => {
    const wrapper = await mountSuspended(SettingsPage, { route: '/settings' })
    await flushPromises()
    expect(wrapper.findAll('[role="radio"]').length).toBeGreaterThanOrEqual(3)
    await wrapper.get('[role="radiogroup"] [role="radio"]:nth-child(2)').trigger('click')
    expect(wrapper.find('#api-key').exists()).toBe(true)
    await wrapper.get('#api-key').setValue('sk-ant-abc-9999')
    await wrapper.findAll('button').find((b) => b.text() === 'Save settings')!.trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="key-status"]').text()).toContain('9999')
  })
})
