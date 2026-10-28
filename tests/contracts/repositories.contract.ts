import { describe, expect, it } from 'vitest'
import type { ItemRepository } from '#shared/contracts/ItemRepository'
import type { StyleMatchRepository } from '#shared/contracts/StyleMatchRepository'
import type { UploadRepository } from '#shared/contracts/UploadRepository'
import type { Upload } from '#shared/models/upload'
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

    it('updates and deletes items', async () => {
      const repo = make()
      const item = seedItems[0]!
      await repo.insert(item)
      await repo.update({ ...item, name: 'Renamed', brand: undefined })
      const back = await repo.findById(item.id)
      expect(back!.name).toBe('Renamed')
      expect(await repo.delete(item.id)).toBe(true)
      expect(await repo.findById(item.id)).toBeNull()
      expect(await repo.delete(item.id)).toBe(false)
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

    it('deletes looks', async () => {
      const repo = make()
      await repo.insert(rated)
      expect(await repo.delete('look-rated')).toBe(true)
      expect(await repo.findById('look-rated')).toBeNull()
      expect(await repo.delete('look-rated')).toBe(false)
    })

    it('lists everything and returns null for unknown ids', async () => {
      const repo = make()
      for (const look of seedStyleMatches) await repo.insert(look)
      expect(await repo.findAll()).toHaveLength(seedStyleMatches.length)
      expect(await repo.findById('nope')).toBeNull()
    })
  })
}

const upload = (id: string, createdAt: string, over: Partial<Upload> = {}): Upload => ({
  id,
  originalImage: `/api/images/${id}.jpg`,
  cleanImage: null,
  state: 'queued',
  stage: null,
  categoryHint: null,
  suggestion: null,
  backgroundRemoved: false,
  error: null,
  createdAt,
  ...over,
})

/** Behaviour every UploadRepository must share. */
export function uploadRepositoryContract(name: string, make: () => UploadRepository) {
  describe(`UploadRepository contract: ${name}`, () => {
    it('stores uploads unchanged and lists them oldest first', async () => {
      const repo = make()
      const later = upload('b', '2026-10-29T10:00:01.000Z', { categoryHint: 'shoes' })
      const first = upload('a', '2026-10-29T10:00:00.000Z')
      await repo.insert(later)
      await repo.insert(first)
      expect(await repo.findAll()).toEqual([first, later])
      expect(await repo.findById('b')).toEqual(later)
      expect(await repo.findById('nope')).toBeNull()
    })

    it('updates progress and results', async () => {
      const repo = make()
      await repo.insert(upload('a', '2026-10-29T10:00:00.000Z'))
      const ready = upload('a', '2026-10-29T10:00:00.000Z', {
        state: 'ready',
        cleanImage: '/api/images/a-clean.png',
        suggestion: { name: 'Red Tee', category: 'tops', colors: ['red'] },
        backgroundRemoved: true,
      })
      await repo.update(ready)
      expect(await repo.findById('a')).toEqual(ready)
    })

    it('deletes uploads', async () => {
      const repo = make()
      await repo.insert(upload('a', '2026-10-29T10:00:00.000Z'))
      expect(await repo.delete('a')).toBe(true)
      expect(await repo.delete('a')).toBe(false)
      expect(await repo.findAll()).toEqual([])
    })
  })
}
