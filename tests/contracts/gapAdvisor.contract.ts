import { describe, expect, it } from 'vitest'
import type { GapAdvisor } from '#shared/contracts/GapAdvisor'
import { seedItems } from '#shared/fixtures/seed'
import { GapSuggestionSchema, MAX_GAPS } from '#shared/models/gap'

const known = new Set(seedItems.map((i) => i.id))

/** Behaviour every GapAdvisor shares: the offline rules and the Claude CLI/API providers. */
export function gapAdvisorContract(name: string, make: () => GapAdvisor) {
  describe(`GapAdvisor contract: ${name}`, () => {
    it('suggests a few distinct, valid pieces that go with real pieces from the wardrobe', async () => {
      const gaps = await make().suggestGaps({ wardrobe: seedItems })
      expect(gaps.length).toBeGreaterThan(0)
      expect(gaps.length).toBeLessThanOrEqual(MAX_GAPS)
      for (const g of gaps) {
        expect(() => GapSuggestionSchema.parse(g)).not.toThrow()
        for (const id of g.pairsWithItemIds) expect(known.has(id)).toBe(true)
        expect(new Set(g.pairsWithItemIds).size).toBe(g.pairsWithItemIds.length)
      }
      expect(new Set(gaps.map((g) => g.name.toLowerCase())).size).toBe(gaps.length)
    })

    it('puts a missing essential first: a wardrobe with no shoes is told to get shoes', async () => {
      const gaps = await make().suggestGaps({ wardrobe: seedItems.filter((i) => i.category !== 'shoes') })
      expect(gaps[0]?.category).toBe('shoes')
    })

    it('starts an empty wardrobe with the basics', async () => {
      const gaps = await make().suggestGaps({ wardrobe: [] })
      expect(gaps.length).toBeGreaterThanOrEqual(3)
      for (const g of gaps) expect(g.pairsWithItemIds).toEqual([])
    })

    it('stops when cancelled', async () => {
      const c = new AbortController()
      c.abort()
      await expect(make().suggestGaps({ wardrobe: seedItems }, { signal: c.signal })).rejects.toMatchObject({ name: 'AbortError' })
    })
  })
}
