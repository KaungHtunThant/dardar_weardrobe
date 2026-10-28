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

  it('generates a look, adds it to the front of recent looks and tracks progress', async () => {
    const store = useStyleMatchesStore()
    await store.load()
    const pending = store.generate({ pinnedItemIds: ['item-linen-tee'], fillCategories: ['bottoms', 'shoes'] })
    expect(store.generating).toBe(true)
    const look = await pending
    expect(store.generating).toBe(false)
    expect(store.recent(1)[0]!.id).toBe(look!.id)
    expect(store.byId(look!.id)?.rating).toBeDefined()
  })

  it('records a generation error and returns null', async () => {
    vi.spyOn(gateway, 'generateLook').mockRejectedValueOnce(new Error('advisor down'))
    const store = useStyleMatchesStore()
    await store.load()
    expect(await store.generate({ fillCategories: ['tops'] })).toBeNull()
    expect(store.generateError).toBe('advisor down')
    expect(store.generating).toBe(false)
  })

  it("loads today's look from the gateway and tracks progress", async () => {
    const store = useStyleMatchesStore()
    await store.load()
    const pending = store.loadToday('2026-10-28')
    expect(store.todayLoading).toBe(true)
    await pending
    expect(store.todayLoading).toBe(false)
    expect(store.todayLook?.id).toBe(store.pickFor('2026-10-28')!.id)
  })

  it("adds a newly styled daily look to the list", async () => {
    const look = { ...(await gateway.listStyleMatches())[0]!, id: 'look-today', dailyPickDate: '2026-10-28' }
    vi.spyOn(gateway, 'getTodayLook').mockResolvedValueOnce(look)
    const store = useStyleMatchesStore()
    await store.load()
    await store.loadToday('2026-10-28')
    expect(store.byId('look-today')).not.toBeNull()
    expect(store.todayLook?.id).toBe('look-today')
  })
})
