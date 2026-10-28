import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import StudioPage from '~/pages/studio.vue'
import { setupTestGateway } from '../helpers'

describe('studio page', () => {
  let warn: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    setupTestGateway()
    warn = vi.spyOn(console, 'warn')
  })
  afterEach(() => {
    expect(warn.mock.calls.flat().join(' ')).not.toMatch(/Failed to resolve component/)
    warn.mockRestore()
  })

  it('composes: picker, AI slots, toggles and the generate button', async () => {
    const wrapper = await mountSuspended(StudioPage, { route: '/studio' })
    await flushPromises()
    expect(wrapper.findAll('[data-testid="piece-grid"] button')).toHaveLength(7)
    expect(wrapper.findAll('[data-testid="ai-slot"]')).toHaveLength(4)
    expect(wrapper.text()).toContain('Generate & rate')
  })

  it('shows the rated result after generating', async () => {
    const wrapper = await mountSuspended(StudioPage, { route: '/studio' })
    await flushPromises()
    const generate = wrapper.findAll('button').find((b) => b.text().includes('Generate & rate'))!
    await generate.trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="score"]').text()).toMatch(/\/10$/)
    expect(wrapper.findAll('[data-testid="result-look"] li').length).toBeGreaterThan(0)
  })
})
