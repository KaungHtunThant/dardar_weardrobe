import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { CATEGORY_IDS } from '#shared/models/category'
import { ItemSchema } from '#shared/models/item'
import { StyleMatchSchema } from '#shared/models/styleMatch'
import { seedItems, seedStyleMatches } from '#shared/fixtures/seed'

describe('seed fixtures', () => {
  it('are valid items with unique ids', () => {
    for (const item of seedItems) expect(() => ItemSchema.parse(item)).not.toThrow()
    expect(new Set(seedItems.map((i) => i.id)).size).toBe(seedItems.length)
  })

  it('fill every closet', () => {
    for (const id of CATEGORY_IDS) expect(seedItems.some((i) => i.category === id)).toBe(true)
  })

  it('point at existing placeholder images', () => {
    for (const item of seedItems) expect(existsSync(`public${item.cleanImage}`)).toBe(true)
  })

  it('are valid looks that only reference seeded items', () => {
    const ids = new Set(seedItems.map((i) => i.id))
    for (const look of seedStyleMatches) {
      expect(() => StyleMatchSchema.parse(look)).not.toThrow()
      for (const id of look.itemIds) expect(ids.has(id)).toBe(true)
    }
    expect(seedStyleMatches.some((l) => l.isFavourite)).toBe(true)
  })
})
