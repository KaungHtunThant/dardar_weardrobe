import { describe, expect, it } from 'vitest'
import type { WardrobeGateway } from '#shared/contracts/WardrobeGateway'
import type { Item } from '#shared/models/item'
import type { StyleMatch } from '#shared/models/styleMatch'
import { ItemDetailsSchema, ItemSchema } from '#shared/models/item'
import { StyleMatchSchema } from '#shared/models/styleMatch'
import { seedItems, seedStyleMatches } from '#shared/fixtures/seed'

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
