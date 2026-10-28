import { describe, expect, it } from 'vitest'
import type { WardrobeGateway } from '#shared/contracts/WardrobeGateway'
import type { Item } from '#shared/models/item'
import type { StyleMatch } from '#shared/models/styleMatch'
import { ItemSchema } from '#shared/models/item'
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

    it('lists all style matches', async () => {
      const gw = await fresh()
      expect(await gw.listStyleMatches()).toHaveLength(seedStyleMatches.length)
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
  })
}
