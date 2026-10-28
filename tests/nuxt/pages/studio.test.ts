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

  it('shows the dress form with AI placeholders and the full wardrobe panel', async () => {
    const wrapper = await mountSuspended(StudioPage, { route: '/studio' })
    await flushPromises()
    expect(wrapper.find('[data-testid="dress-form"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="ai-slot"]')).toHaveLength(4)
    expect(wrapper.findAll('[data-testid="panel-grid"] button')).toHaveLength(33)
  })

  it('dresses the form from the panel and filters the panel from the form', async () => {
    const wrapper = await mountSuspended(StudioPage, { route: '/studio' })
    await flushPromises()
    await wrapper.get('[aria-label="Wear Red Pumps"]').trigger('click')
    const piece = wrapper.get('[data-testid="worn-piece"]')
    expect(piece.attributes('data-slot')).toBe('feet')
    await piece.trigger('click')
    expect(wrapper.findAll('[data-testid="panel-grid"] button')).toHaveLength(4)
  })

  it('shows the verdict after generating', async () => {
    const wrapper = await mountSuspended(StudioPage, { route: '/studio' })
    await flushPromises()
    await wrapper.findAll('button').find((b) => b.text().includes('Generate & rate'))!.trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="score"]').text()).toMatch(/\/10$/)
    expect(wrapper.findAll('[data-testid="worn-piece"][data-ai="true"]').length).toBeGreaterThan(0)
  })
})
