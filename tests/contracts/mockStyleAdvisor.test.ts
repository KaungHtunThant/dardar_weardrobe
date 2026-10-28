import { describe, expect, it } from 'vitest'
import { seedItems } from '#shared/fixtures/seed'
import { MockStyleAdvisor } from '~/gateways/mock/MockStyleAdvisor'
import { styleAdvisorContract } from './styleAdvisor.contract'

styleAdvisorContract('MockStyleAdvisor', () => new MockStyleAdvisor())

const advisor = new MockStyleAdvisor()
const ask = (pinnedItemIds: string[], fillCategories: string[] = [], prompt?: string) =>
  advisor.suggestLook({ wardrobe: seedItems, pinnedItemIds, fillCategories: fillCategories as never, prompt })

describe('MockStyleAdvisor heuristics', () => {
  it('is brutal about a clashing, confused look', async () => {
    const look = await ask(['item-red-evening-dress', 'item-white-sneakers', 'item-straw-hat', 'item-lavender-cardigan'])
    expect(look.rating.score).toBeLessThanOrEqual(4)
    expect(look.rating.fails.length).toBeGreaterThan(0)
    expect(look.rating.fixes.length).toBeGreaterThan(0)
  })

  it('rewards a cohesive look', async () => {
    const look = await ask(['item-silk-blouse', 'item-black-trousers', 'item-nude-heels', 'item-black-handbag'])
    expect(look.rating.score).toBeGreaterThanOrEqual(7)
    expect(look.rating.works.length).toBeGreaterThan(0)
  })

  it('calls out a missing pair of shoes and suggests one', async () => {
    const look = await ask(['item-linen-tee', 'item-straight-jeans'])
    expect(look.rating.fails.join(' ')).toMatch(/shoes/i)
    const fix = look.rating.fixes.find((f) => f.addItemId && seedItems.find((i) => i.id === f.addItemId)?.category === 'shoes')
    expect(fix).toBeDefined()
  })

  it('follows the prompt when choosing pieces', async () => {
    const look = await ask([], ['dresses', 'tops', 'bottoms', 'shoes'], 'a glamorous evening party')
    const occasions = look.aiItemIds.flatMap((id) => seedItems.find((i) => i.id === id)!.occasions)
    expect(occasions.filter((o) => o === 'evening' || o === 'party').length).toBeGreaterThanOrEqual(2)
  })

  it('is deterministic for the same request', async () => {
    const a = await ask(['item-cream-knit'], ['bottoms', 'shoes', 'outerwear'], 'cozy autumn walk')
    const b = await ask(['item-cream-knit'], ['bottoms', 'shoes', 'outerwear'], 'cozy autumn walk')
    expect(a).toEqual(b)
  })
})
