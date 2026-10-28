import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import LooksPage from '~/pages/looks.vue'
import { setupTestGateway } from '../helpers'

describe('looks page', () => {
  let warn: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    setupTestGateway()
    warn = vi.spyOn(console, 'warn')
  })
  afterEach(() => {
    expect(warn.mock.calls.flat().join(' ')).not.toMatch(/Failed to resolve component/)
    warn.mockRestore()
  })

  it('shows every look with its actions', async () => {
    const wrapper = await mountSuspended(LooksPage, { route: '/looks' })
    await flushPromises()
    expect(wrapper.findAll('[data-testid="look-card"]')).toHaveLength(6)
    expect(wrapper.text()).toContain('Open in Studio')
  })
})
