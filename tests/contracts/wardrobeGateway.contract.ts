import { describe, expect, it } from 'vitest'
import type { StyleProgress } from '#shared/contracts/StyleAdvisor'
import type { WardrobeGateway } from '#shared/contracts/WardrobeGateway'
import type { Item } from '#shared/models/item'
import type { StyleMatch } from '#shared/models/styleMatch'
import { ItemDetailsSchema, ItemSchema } from '#shared/models/item'
import { StyleMatchSchema } from '#shared/models/styleMatch'
import { seedItems, seedStyleMatches } from '#shared/fixtures/seed'
import { DayWeatherSchema, PlaceSchema } from '#shared/models/weather'
import { GapReportSchema } from '#shared/models/gap'
import { localIsoDate } from '#shared/utils/date'

export interface GatewaySeed {
  items: Item[]
  styleMatches: StyleMatch[]
}

/**
 * Behaviour every WardrobeGateway must share (Liskov): the mock, the HTTP gateway, …
 * `make` receives the seed data and returns a fresh gateway.
 */
export function wardrobeGatewayContract(name: string, make: (seed: GatewaySeed) => Promise<WardrobeGateway>) {
  const fresh = () =>
    make({ items: structuredClone(seedItems), styleMatches: structuredClone(seedStyleMatches) })

  const photo = () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })

  describe(`WardrobeGateway contract: ${name}`, () => {
    it('lists all items', async () => {
      const gw = await fresh()
      const items = await gw.listItems()
      expect(items.map((i) => i.id).sort()).toEqual(seedItems.map((i) => i.id).sort())
    })

    it('turns a photo into displayable original and clean images', async () => {
      const gw = await fresh()
      const processed = await gw.removeBackground(photo())
      expect(processed.originalImage).toBeTruthy()
      expect(processed.cleanImage).toBeTruthy()
    })

    it('creates an item with id, timestamp and defaults, and lists it', async () => {
      const gw = await fresh()
      const processed = await gw.removeBackground(photo())
      const item = await gw.createItem({ name: '  Pink Beret ', category: 'accessories', ...processed })
      expect(() => ItemSchema.parse(item)).not.toThrow()
      expect(item.name).toBe('Pink Beret')
      expect(item.isFavourite).toBe(false)
      expect((await gw.listItems()).some((i) => i.id === item.id)).toBe(true)
    })

    it('rejects invalid item details', async () => {
      const gw = await fresh()
      const processed = await gw.removeBackground(photo())
      await expect(gw.createItem({ name: '', category: 'tops', ...processed })).rejects.toThrow()
    })

    /** Polls like the app does until no photo is waiting or being prepared. */
    async function settled(gw: WardrobeGateway) {
      for (let i = 0; i < 200; i++) {
        const uploads = await gw.listUploads()
        if (uploads.every((u) => u.state === 'ready' || u.state === 'failed')) return uploads
        await new Promise((r) => setTimeout(r, 10))
      }
      throw new Error('uploads never settled')
    }

    it('queues photos at once and prepares them in the background, with valid suggestions', async () => {
      const gw = await fresh()
      const queued = await gw.enqueuePhotos([photo(), photo()], { categoryHint: 'tops' })
      expect(queued).toHaveLength(2)
      for (const u of queued) expect(['queued', 'processing']).toContain(u.state)
      expect(queued[0]!.categoryHint).toBe('tops')
      const ready = await settled(gw)
      expect(ready.map((u) => u.state)).toEqual(['ready', 'ready'])
      for (const u of ready) {
        expect(u.cleanImage).toBeTruthy()
        expect(() => ItemDetailsSchema.partial().parse(u.suggestion ?? {})).not.toThrow()
      }
    })

    it('saves a prepared photo as a piece, and discards another', async () => {
      const gw = await fresh()
      await gw.enqueuePhotos([photo(), photo()])
      const [first, second] = await settled(gw)
      await expect(gw.saveUpload(first!.id, { name: '', category: 'tops' })).rejects.toThrow()
      const item = await gw.saveUpload(first!.id, { name: 'Silk Cami', category: 'tops' })
      expect(item).toMatchObject({ name: 'Silk Cami', cleanImage: first!.cleanImage })
      expect((await gw.listItems()).some((i) => i.id === item.id)).toBe(true)
      await gw.discardUpload(second!.id)
      expect(await gw.listUploads()).toEqual([])
    })

    it('refuses to queue something that is not a photo', async () => {
      const gw = await fresh()
      await expect(gw.enqueuePhotos([new Blob(['x'], { type: 'text/plain' })])).rejects.toThrow()
    })

    it('suggests details for an uploaded photo (possibly nothing, never invalid values)', async () => {
      const gw = await fresh()
      const { cleanImage } = await gw.removeBackground(photo())
      const suggestion = await gw.suggestDetails(cleanImage)
      expect(() => ItemDetailsSchema.partial().parse(suggestion)).not.toThrow()
    })

    it("returns the same look for today every time, made of wardrobe pieces", async () => {
      const gw = await fresh()
      const first = await gw.getTodayLook('2026-10-28')
      expect(first).not.toBeNull()
      expect((await gw.getTodayLook('2026-10-28'))!.id).toBe(first!.id)
      const ids = new Set(seedItems.map((i) => i.id))
      for (const id of first!.itemIds) expect(ids.has(id)).toBe(true)
    })

    it('edits a piece: details change, photos and identity stay', async () => {
      const gw = await fresh()
      const tee = seedItems.find((i) => i.id === 'item-linen-tee')!
      const updated = await gw.updateItem(tee.id, { name: '  Linen Shirt ', category: 'outerwear', colors: ['ivory'], brand: '' })
      expect(updated).toMatchObject({ id: tee.id, name: 'Linen Shirt', category: 'outerwear', colors: ['ivory'], cleanImage: tee.cleanImage, createdAt: tee.createdAt })
      expect(updated.brand).toBeUndefined()
      expect((await gw.listItems()).find((i) => i.id === tee.id)!.category).toBe('outerwear')
      await expect(gw.updateItem(tee.id, { name: '', category: 'tops' })).rejects.toThrow()
      await expect(gw.updateItem('item-nope', { name: 'X', category: 'tops' })).rejects.toThrow()
    })

    it("replaces a piece's photo", async () => {
      const gw = await fresh()
      const processed = await gw.removeBackground(photo())
      const updated = await gw.replaceItemPhoto('item-linen-tee', processed)
      expect(updated.cleanImage).toBe(processed.cleanImage)
      expect(updated.originalImage).toBe(processed.originalImage)
    })

    it('deletes a piece and removes it from every look (empty looks go too)', async () => {
      const gw = await fresh()
      const solo = await gw.generateLook({ pinnedItemIds: ['item-gold-necklace'] })
      await gw.deleteItem('item-gold-necklace')
      expect((await gw.listItems()).some((i) => i.id === 'item-gold-necklace')).toBe(false)
      const looks = await gw.listStyleMatches()
      expect(looks.some((l) => l.itemIds.includes('item-gold-necklace'))).toBe(false)
      expect(looks.some((l) => l.id === solo.id)).toBe(false)
      expect(looks.find((l) => l.id === 'look-office-chic')!.itemIds).not.toContain('item-gold-necklace')
      await expect(gw.deleteItem('item-gold-necklace')).rejects.toThrow()
    })

    it('deletes a look', async () => {
      const gw = await fresh()
      await gw.deleteLook('look-date-night')
      expect((await gw.listStyleMatches()).some((l) => l.id === 'look-date-night')).toBe(false)
      await expect(gw.deleteLook('look-date-night')).rejects.toThrow()
    })

    it('lists all style matches', async () => {
      const gw = await fresh()
      expect((await gw.listStyleMatches()).length).toBeGreaterThanOrEqual(seedStyleMatches.length)
    })

    it('toggles a look as favourite and keeps it', async () => {
      const gw = await fresh()
      const target = seedStyleMatches.find((l) => !l.isFavourite)!
      expect((await gw.setFavourite(target.id, true)).isFavourite).toBe(true)
      const stored = (await gw.listStyleMatches()).find((l) => l.id === target.id)
      expect(stored?.isFavourite).toBe(true)
    })

    it('rejects favouriting an unknown look', async () => {
      const gw = await fresh()
      await expect(gw.setFavourite('nope', true)).rejects.toThrow()
    })

    it('generates a rated look from picks plus AI-filled categories and saves it', async () => {
      const gw = await fresh()
      const look = await gw.generateLook({
        pinnedItemIds: ['item-linen-tee'],
        fillCategories: ['bottoms', 'shoes'],
        prompt: 'weekend coffee',
      })
      expect(() => StyleMatchSchema.parse(look)).not.toThrow()
      expect(look.itemIds[0]).toBe('item-linen-tee')
      expect(look.aiItemIds?.length).toBeGreaterThan(0)
      expect(look.rating?.score).toBeGreaterThanOrEqual(1)
      expect(look.prompt).toBe('weekend coffee')
      expect((await gw.listStyleMatches()).some((l) => l.id === look.id)).toBe(true)
    })

    it('reports progress while it styles, starting with reading the wardrobe', async () => {
      const gw = await fresh()
      const progress: StyleProgress[] = []
      const look = await gw.generateLook({ pinnedItemIds: ['item-linen-tee'], fillCategories: ['shoes'] }, { onProgress: (p) => progress.push(p) })
      expect(progress[0]).toEqual({ stage: 'reading', aiItemIds: [] })
      for (const p of progress) expect(look.aiItemIds?.slice(0, p.aiItemIds.length)).toEqual(p.aiItemIds)
    })

    it('cancelling rejects with an AbortError and saves no look', async () => {
      const gw = await fresh()
      const before = (await gw.listStyleMatches()).length
      await expect(gw.generateLook({ fillCategories: ['tops'] }, { signal: AbortSignal.abort() })).rejects.toMatchObject({ name: 'AbortError' })
      expect(await gw.listStyleMatches()).toHaveLength(before)
    })

    it('reads stylist settings without ever exposing the API key', async () => {
      const gw = await fresh()
      const view = await gw.getSettings()
      expect(['claude-cli', 'claude-api', 'offline']).toContain(view.advisor)
      expect(view.model).toBeTruthy()
      const updated = await gw.updateSettings({ advisor: 'offline', model: 'claude-sonnet-5-5', apiKey: 'sk-ant-test-4242' })
      expect(updated).toMatchObject({ advisor: 'offline', model: 'claude-sonnet-5-5' })
      expect(updated.apiKey).toMatchObject({ present: true, last4: '4242' })
      expect(JSON.stringify(await gw.getSettings())).not.toContain('sk-ant-test')
      expect((await gw.updateSettings({ apiKey: null })).apiKey.present).toBe(false)
    })

    it('has a stylist agent set up, which can be recreated, and remembers the welcome', async () => {
      const gw = await fresh()
      const view = await gw.getSettings()
      expect(view.agent).toMatchObject({ name: 'dardar-stylist', displayName: 'Dardar' })
      expect(view.welcomed).toBe(false)
      expect((await gw.updateSettings({ welcomed: true })).welcomed).toBe(true)
      expect((await gw.recreateAgent()).agent).toMatchObject({ name: 'dardar-stylist' })
    })

    it('clears the whole wardrobe but keeps the settings', async () => {
      const gw = await fresh()
      await gw.updateSettings({ advisor: 'offline', model: 'claude-haiku-5-5' })
      const { cleanImage, originalImage } = await gw.removeBackground(photo())
      await gw.createItem({ name: 'Beret', category: 'accessories', cleanImage, originalImage })
      await gw.clearWardrobe()
      expect(await gw.listItems()).toEqual([])
      expect(await gw.listStyleMatches()).toEqual([])
      expect(await gw.getTodayLook('2026-10-28')).toBeNull()
      expect((await gw.getSettings()).model).toBe('claude-haiku-5-5')
    })

    it('changes only the settings an update names', async () => {
      const gw = await fresh()
      await gw.updateSettings({ advisor: 'offline', model: 'claude-haiku-5-5', effort: 'high' })
      expect(await gw.updateSettings({ welcomed: true })).toMatchObject({ model: 'claude-haiku-5-5', effort: 'high' })
    })

    it('finds cities and suggests where the user is', async () => {
      const gw = await fresh()
      const found = await gw.searchPlaces('London')
      expect(found[0]).toMatchObject({ name: 'London' })
      for (const p of found) expect(() => PlaceSchema.parse(p)).not.toThrow()
      expect(await gw.searchPlaces(' ')).toEqual([])
      const here = await gw.locatePlace()
      if (here) expect(() => PlaceSchema.parse(here)).not.toThrow()
    })

    it('keeps the city in the settings and has its weather; no city, no weather', async () => {
      const gw = await fresh()
      const today = localIsoDate(new Date())
      expect((await gw.getSettings()).location).toBeNull()
      expect(await gw.getWeather(today)).toBeNull()
      const [london] = await gw.searchPlaces('London')
      expect((await gw.updateSettings({ location: london })).location).toMatchObject({ name: 'London' })
      const weather = await gw.getWeather(today)
      expect(() => DayWeatherSchema.parse(weather)).not.toThrow()
      expect(weather).toMatchObject({ date: today, place: expect.stringContaining('London') })
      expect((await gw.updateSettings({ location: null })).location).toBeNull()
    })

    it("styles a look for today's weather, unless asked not to", async () => {
      const gw = await fresh()
      const [london] = await gw.searchPlaces('London')
      await gw.updateSettings({ location: london })
      const dressed = await gw.generateLook({ fillCategories: ['tops', 'bottoms'] })
      expect(dressed.weather?.place).toContain('London')
      expect((await gw.listStyleMatches()).find((l) => l.id === dressed.id)?.weather).toEqual(dressed.weather)
      expect((await gw.generateLook({ fillCategories: ['tops'], dressForWeather: false })).weather).toBeUndefined()
    })

    it("says what the wardrobe is missing, keeps it until the wardrobe changes, and can ask again", async () => {
      const gw = await fresh()
      const report = await gw.getWardrobeGaps()
      expect(() => GapReportSchema.parse(report)).not.toThrow()
      expect(report!.gaps.length).toBeGreaterThan(0)
      const known = new Set(seedItems.map((i) => i.id))
      for (const g of report!.gaps) for (const id of g.pairsWithItemIds) expect(known.has(id)).toBe(true)
      expect(await gw.getWardrobeGaps()).toEqual(report)

      const [london] = await gw.searchPlaces('London')
      await gw.updateSettings({ location: london })
      expect((await gw.getWardrobeGaps())!.place).toBe('London, United Kingdom')

      await gw.deleteItem(seedItems[0]!.id)
      expect((await gw.getWardrobeGaps())!.wardrobeKey).not.toBe(report!.wardrobeKey)
      const refreshed = await gw.refreshWardrobeGaps()
      expect(() => GapReportSchema.parse(refreshed)).not.toThrow()

      await gw.clearWardrobe()
      expect(await gw.getWardrobeGaps()).toBeNull()
    })

    it('rejects invalid settings', async () => {
      const gw = await fresh()
      await expect(gw.updateSettings({ advisor: 'gpt' as never })).rejects.toThrow()
    })

    it('rejects an empty or unknown styling request', async () => {
      const gw = await fresh()
      await expect(gw.generateLook({ pinnedItemIds: [], fillCategories: [] })).rejects.toThrow()
      await expect(gw.generateLook({ pinnedItemIds: ['item-ghost'] })).rejects.toThrow()
    })
  })
}
