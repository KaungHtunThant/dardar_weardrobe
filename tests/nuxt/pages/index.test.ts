import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import IndexPage from '~/pages/index.vue'
import { setupTestGateway } from '../helpers'

describe('home page', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 28, 9, 0))
  })
  afterEach(() => vi.useRealTimers())

  it("renders today's recommendation, recent matches and favourite looks", async () => {
    setupTestGateway()
    const wrapper = await mountSuspended(IndexPage)
    await flushPromises()
    expect(wrapper.text()).toContain("Today's recommendation")
    expect(wrapper.find('#recent-title').text()).toBe('Recently styled')
    expect(wrapper.find('#favourites-title').text()).toBe('Favourite looks')
    expect(wrapper.findAll('[data-testid="look-card"]').length).toBeGreaterThan(3)
    expect(wrapper.find('[data-testid="today-collage"] img').attributes('src')).toMatch(/^\/garments\//)
  })

  it('shows empty states with an empty wardrobe', async () => {
    setupTestGateway({ items: [], styleMatches: [] })
    const wrapper = await mountSuspended(IndexPage)
    await flushPromises()
    expect(wrapper.text()).toContain('No recommendation yet')
    expect(wrapper.text()).toContain('No favourites yet')
  })
})
