import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useStyleMatchesStore } from '~/stores/styleMatches'
import { setupTestGateway } from '../helpers'

describe('style matches store', () => {
  let gateway: ReturnType<typeof setupTestGateway>
  beforeEach(() => {
    gateway = setupTestGateway()
  })

  it('loads looks and exposes recent and favourite lists', async () => {
    const store = useStyleMatchesStore()
    await store.load()
    expect(store.recent(2).map((l) => l.id)).toEqual(['look-summer-party', 'look-cozy-autumn'])
    expect(store.favourites.every((l) => l.isFavourite)).toBe(true)
  })

  it("picks today's look", async () => {
    const store = useStyleMatchesStore()
    await store.load()
    expect(store.pickFor('2026-10-28')).not.toBeNull()
  })

  it('toggles favourite optimistically', async () => {
    const store = useStyleMatchesStore()
    await store.load()
    const pending = store.toggleFavourite('look-date-night')
    expect(store.looks.find((l) => l.id === 'look-date-night')!.isFavourite).toBe(true)
    await pending
    expect((await gateway.listStyleMatches()).find((l) => l.id === 'look-date-night')!.isFavourite).toBe(true)
  })

  it('rolls back the favourite when saving fails', async () => {
    vi.spyOn(gateway, 'setFavourite').mockRejectedValueOnce(new Error('nope'))
    const store = useStyleMatchesStore()
    await store.load()
    await store.toggleFavourite('look-date-night')
    expect(store.looks.find((l) => l.id === 'look-date-night')!.isFavourite).toBe(false)
    expect(store.error).toBe('nope')
  })
})
