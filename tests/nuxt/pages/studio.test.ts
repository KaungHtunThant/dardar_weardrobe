import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import StudioPage from '~/pages/studio.vue'
import { DEMO_PLACES } from '#shared/weather/DemoWeather'
import { setupTestGateway } from '../helpers'

describe('studio page', () => {
  let warn: ReturnType<typeof vi.spyOn>
  let gateway: ReturnType<typeof setupTestGateway>
  beforeEach(() => {
    gateway = setupTestGateway()
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
    expect(wrapper.findAll('[data-testid="panel-grid"] > div')).toHaveLength(33)
  })

  it('dresses the form from the panel and filters the panel from the form', async () => {
    const wrapper = await mountSuspended(StudioPage, { route: '/studio' })
    await flushPromises()
    await wrapper.get('[aria-label="Wear Red Pumps"]').trigger('click')
    const piece = wrapper.get('[data-testid="worn-piece"]')
    expect(piece.attributes('data-slot')).toBe('feet')
    await piece.trigger('click')
    expect(wrapper.findAll('[data-testid="panel-grid"] > div')).toHaveLength(4)
  })

  it('offers to dress for the weather and says what the verdict was rated for', async () => {
    await gateway.updateSettings({ location: DEMO_PLACES.find((p) => p.name === 'London')! })
    const wrapper = await mountSuspended(StudioPage, { route: '/studio' })
    await flushPromises()
    const toggle = wrapper.get('[data-testid="studio-weather"]')
    expect(toggle.attributes('aria-checked')).toBe('true')
    expect(toggle.text()).toContain('London')
    await wrapper.findAll('button').find((b) => b.text().includes('Generate & rate'))!.trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="verdict-weather"]').text()).toMatch(/Rated for .+ in London/)
  })

  it('invites the user to add a city without one', async () => {
    const wrapper = await mountSuspended(StudioPage, { route: '/studio' })
    await flushPromises()
    expect(wrapper.get('[data-testid="studio-ask-for-city"]').text()).toMatch(/add your city/i)
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
