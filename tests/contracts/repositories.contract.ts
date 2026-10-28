import { describe, expect, it } from 'vitest'
import type { ItemRepository } from '#shared/contracts/ItemRepository'
import type { StyleMatchRepository } from '#shared/contracts/StyleMatchRepository'
import { seedItems, seedStyleMatches } from '#shared/fixtures/seed'

/** Behaviour every ItemRepository must share. */
export function itemRepositoryContract(name: string, make: () => ItemRepository) {
  describe(`ItemRepository contract: ${name}`, () => {
    it('stores and returns items unchanged (optional fields stay absent)', async () => {
      const repo = make()
      const withBrand = seedItems.find((i) => i.brand)!
      const withoutBrand = seedItems.find((i) => !i.brand)!
      await repo.insert(withBrand)
      await repo.insert(withoutBrand)
      expect(await repo.findById(withBrand.id)).toEqual(withBrand)
      const back = await repo.findById(withoutBrand.id)
      expect(back).toEqual(withoutBrand)
      expect(back && 'brand' in back).toBe(false)
    })

    it('lists everything', async () => {
      const repo = make()
      for (const item of seedItems) await repo.insert(item)
      expect((await repo.findAll()).map((i) => i.id).sort()).toEqual(seedItems.map((i) => i.id).sort())
    })

    it('returns null for an unknown id and rejects duplicate ids', async () => {
      const repo = make()
      expect(await repo.findById('nope')).toBeNull()
      await repo.insert(seedItems[0]!)
      await expect(repo.insert(seedItems[0]!)).rejects.toThrow()
    })
  })
}

/** Behaviour every StyleMatchRepository must share. */
export function styleMatchRepositoryContract(name: string, make: () => StyleMatchRepository) {
  const rated = {
    ...seedStyleMatches[2]!,
    id: 'look-rated',
    aiItemIds: [seedStyleMatches[2]!.itemIds[0]!],
    rating: {
      score: 3,
      verdict: 'This needs an intervention.',
      works: ['Something'],
      fails: ['Something else'],
      fixes: [{ removeItemId: 'a', addItemId: 'b', note: 'Swap.' }],
    },
    dailyPickDate: '2026-10-28',
  }

  describe(`StyleMatchRepository contract: ${name}`, () => {
    it('round-trips looks, including ratings, prompts and AI picks', async () => {
      const repo = make()
      await repo.insert(rated)
      await repo.insert(seedStyleMatches[0]!)
      expect(await repo.findById('look-rated')).toEqual(rated)
      expect(await repo.findById(seedStyleMatches[0]!.id)).toEqual(seedStyleMatches[0])
    })

    it('updates a look', async () => {
      const repo = make()
      await repo.insert(rated)
      await repo.update({ ...rated, isFavourite: true })
      expect((await repo.findById('look-rated'))!.isFavourite).toBe(true)
    })

    it('lists everything and returns null for unknown ids', async () => {
      const repo = make()
      for (const look of seedStyleMatches) await repo.insert(look)
      expect(await repo.findAll()).toHaveLength(seedStyleMatches.length)
      expect(await repo.findById('nope')).toBeNull()
    })
  })
}
