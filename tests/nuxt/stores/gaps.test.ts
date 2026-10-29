import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGapsStore } from '~/stores/gaps'
import { setupTestGateway } from '../helpers'

describe('gaps store', () => {
  let gateway: ReturnType<typeof setupTestGateway>
  beforeEach(() => {
    gateway = setupTestGateway()
  })

  it('loads what the wardrobe is missing', async () => {
    const store = useGapsStore()
    const pending = store.load()
    expect(store.loading).toBe(true)
    await pending
    expect(store.loading).toBe(false)
    expect(store.report?.gaps.length).toBeGreaterThan(0)
  })

  it('asks the stylist again on request, showing it is busy', async () => {
    const store = useGapsStore()
    await store.load()
    const spy = vi.spyOn(gateway, 'refreshWardrobeGaps')
    const pending = store.refresh()
    expect(store.refreshing).toBe(true)
    await pending
    expect(spy).toHaveBeenCalled()
    expect(store.refreshing).toBe(false)
  })

  it('shows a failure without losing the last report', async () => {
    const store = useGapsStore()
    await store.load()
    vi.spyOn(gateway, 'refreshWardrobeGaps').mockRejectedValue(new Error('Claude is busy'))
    await store.refresh()
    expect(store.error).toBe('Claude is busy')
    expect(store.report).not.toBeNull()
  })

  it('forgets the report after the wardrobe is cleared', async () => {
    const store = useGapsStore()
    await store.load()
    store.forget()
    expect(store.report).toBeNull()
  })
})
