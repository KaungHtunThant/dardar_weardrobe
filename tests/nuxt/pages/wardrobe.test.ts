import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { useRouter } from '#imports'
import WardrobePage from '~/pages/wardrobe/index.vue'
import { setupTestGateway } from '../helpers'

describe('wardrobe page', () => {
  let warn: ReturnType<typeof vi.spyOn>
  beforeEach(async () => {
    setupTestGateway()
    warn = vi.spyOn(console, 'warn')
    await useRouter().replace({ path: '/', query: {} })
  })
  afterEach(() => {
    // Every component in the page must resolve (catches Nuxt auto-import naming slips).
    expect(warn.mock.calls.flat().join(' ')).not.toMatch(/Failed to resolve component/)
    warn.mockRestore()
  })

  it('renders the closet wall by default', async () => {
    const wrapper = await mountSuspended(WardrobePage)
    await flushPromises()
    expect(wrapper.findAll('[data-testid="closet-tile"]')).toHaveLength(7)
  })

  it('renders the item grid in list view', async () => {
    const wrapper = await mountSuspended(WardrobePage, { route: '/?view=list&filter=dresses' })
    await flushPromises()
    expect(wrapper.findAll('[data-testid="item-card"]')).toHaveLength(5)
  })

  it('opens the add dialog from the floating button', async () => {
    const wrapper = await mountSuspended(WardrobePage, { attachTo: document.body })
    await flushPromises()
    await wrapper.get('button.fixed').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('Add to your wardrobe')
    wrapper.unmount()
  })
})
