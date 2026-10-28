import { describe, expect, it } from 'vitest'
import type { StyleAdvisor, StyleAdvisorRequest, StyleCallOptions, StyleProgress } from '#shared/contracts/StyleAdvisor'
import { StyleRatingSchema } from '#shared/models/styleMatch'
import { seedItems } from '#shared/fixtures/seed'

const byId = new Map(seedItems.map((i) => [i.id, i]))
const ask = (advisor: StyleAdvisor, req: Partial<StyleAdvisorRequest>, options?: StyleCallOptions) =>
  advisor.suggestLook({ wardrobe: seedItems, pinnedItemIds: [], fillCategories: [], ...req }, options)

/** Behaviour every StyleAdvisor must share: the mock now, the Claude CLI/API providers in Phase 4. */
export function styleAdvisorContract(name: string, make: () => StyleAdvisor) {
  describe(`StyleAdvisor contract: ${name}`, () => {
    it('keeps every picked piece, first and in order', async () => {
      const pinned = ['item-silk-blouse', 'item-black-trousers']
      const look = await ask(make(), { pinnedItemIds: pinned, fillCategories: ['shoes', 'bags'] })
      expect(look.itemIds.slice(0, 2)).toEqual(pinned)
    })

    it('adds at most one existing piece per allowed category and reports them as AI picks', async () => {
      const look = await ask(make(), { pinnedItemIds: ['item-linen-tee'], fillCategories: ['bottoms', 'shoes', 'bags'] })
      const added = look.itemIds.filter((id) => id !== 'item-linen-tee')
      expect(look.aiItemIds).toEqual(added)
      const categories = added.map((id) => byId.get(id)!.category)
      expect(new Set(categories).size).toBe(categories.length)
      for (const c of categories) expect(['bottoms', 'shoes', 'bags']).toContain(c)
    })

    it('does not fill a category the user already picked from', async () => {
      const look = await ask(make(), { pinnedItemIds: ['item-linen-tee'], fillCategories: ['tops', 'bottoms'] })
      expect(look.aiItemIds.every((id) => byId.get(id)!.category !== 'tops')).toBe(true)
    })

    it('never pairs its own dress with a top or bottom', async () => {
      const look = await ask(make(), { fillCategories: ['dresses', 'tops', 'bottoms', 'shoes'] })
      const cats = look.itemIds.map((id) => byId.get(id)!.category)
      if (cats.includes('dresses')) expect(cats.some((c) => c === 'tops' || c === 'bottoms')).toBe(false)
    })

    it('builds a whole look when nothing is picked', async () => {
      const look = await ask(make(), { fillCategories: ['tops', 'bottoms', 'shoes'] })
      expect(look.itemIds.length).toBeGreaterThanOrEqual(3)
      expect(look.aiItemIds).toEqual(look.itemIds)
    })

    it('only rates when no categories are open to the AI', async () => {
      const pinned = ['item-little-black-dress', 'item-red-heels']
      const look = await ask(make(), { pinnedItemIds: pinned })
      expect(look.itemIds).toEqual(pinned)
      expect(look.aiItemIds).toEqual([])
    })

    it('returns a valid rating whose fixes use real wardrobe pieces', async () => {
      const look = await ask(make(), { pinnedItemIds: ['item-red-evening-dress', 'item-white-sneakers', 'item-straw-hat'] })
      expect(() => StyleRatingSchema.parse(look.rating)).not.toThrow()
      for (const fix of look.rating.fixes) {
        if (fix.addItemId) expect(byId.has(fix.addItemId)).toBe(true)
        if (fix.removeItemId) expect(look.itemIds).toContain(fix.removeItemId)
      }
      expect(look.title.trim()).not.toBe('')
    })

    it('reports progress only with pieces it really adds, in order', async () => {
      const progress: StyleProgress[] = []
      const look = await ask(make(), { pinnedItemIds: ['item-linen-tee'], fillCategories: ['bottoms', 'shoes', 'bags'] }, { onProgress: (p) => progress.push(p) })
      for (const p of progress) expect(look.aiItemIds.slice(0, p.aiItemIds.length)).toEqual(p.aiItemIds)
    })

    it('stops with an AbortError when cancelled, without answering', async () => {
      await expect(ask(make(), { fillCategories: ['tops', 'bottoms'] }, { signal: AbortSignal.abort() })).rejects.toMatchObject({ name: 'AbortError' })
    })

    it('rejects picks that are not in the wardrobe', async () => {
      await expect(ask(make(), { pinnedItemIds: ['item-ghost'] })).rejects.toThrow()
    })
  })
}
