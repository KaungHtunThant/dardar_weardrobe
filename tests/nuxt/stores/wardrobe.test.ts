import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWardrobeStore } from '~/stores/wardrobe'
import { setupTestGateway } from '../helpers'

describe('wardrobe store', () => {
  let gateway: ReturnType<typeof setupTestGateway>
  beforeEach(() => {
    gateway = setupTestGateway()
  })

  it('loads items once and exposes them newest first', async () => {
    const spy = vi.spyOn(gateway, 'listItems')
    const store = useWardrobeStore()
    await store.load()
    await store.load()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(store.items[0]!.id).toBe('item-sunglasses')
    expect(store.loaded).toBe(true)
  })

  it('counts items per category', async () => {
    const store = useWardrobeStore()
    await store.load()
    expect(store.counts.tops).toBe(7)
    expect(store.counts.shoes).toBe(4)
  })

  it('filters by category', async () => {
    const store = useWardrobeStore()
    await store.load()
    expect(store.byCategory('bags').every((i) => i.category === 'bags')).toBe(true)
    expect(store.byCategory('all')).toHaveLength(store.items.length)
  })

  it('removes a background then adds the item at the top', async () => {
    const store = useWardrobeStore()
    await store.load()
    const processed = await store.prepareImage(new Blob(['x'], { type: 'image/png' }))
    const item = await store.addItem({ name: 'Pink Beret', category: 'accessories', ...processed })
    expect(store.items[0]).toEqual(item)
  })

  it('records a load error', async () => {
    vi.spyOn(gateway, 'listItems').mockRejectedValueOnce(new Error('boom'))
    const store = useWardrobeStore()
    await store.load()
    expect(store.error).toBe('boom')
    expect(store.loaded).toBe(false)
  })
})
