import { describe, expect, it } from 'vitest'
import type { StyleProgress } from '#shared/contracts/StyleAdvisor'
import { seedItems } from '#shared/fixtures/seed'
import { styleProgressReporter } from '../../server/ai/styleProgress'

const request = { wardrobe: seedItems, pinnedItemIds: ['item-linen-tee'], fillCategories: ['tops', 'bottoms', 'shoes'] as const }

function collect() {
  const seen: StyleProgress[] = []
  const report = styleProgressReporter({ ...request, fillCategories: [...request.fillCategories] }, (p) => seen.push(p))
  return { seen, report }
}

describe('styleProgressReporter', () => {
  it('reports the title and only real, allowed AI picks as they arrive', () => {
    const { seen, report } = collect()
    report({ title: 'Gallery Ni' })
    report({ title: 'Gallery Night', itemIds: ['item-linen-tee', 'item-ghost', 'item-burgundy-skirt'] })
    report({ title: 'Gallery Night', itemIds: ['item-linen-tee', 'item-burgundy-skirt', 'item-black-tee', 'item-ankle-boots'] })
    expect(seen).toEqual([
      { stage: 'picking', title: 'Gallery Ni', aiItemIds: [] },
      { stage: 'picking', title: 'Gallery Night', aiItemIds: ['item-burgundy-skirt'] },
      // the black tee is dropped: tops are covered by the user's pick
      { stage: 'picking', title: 'Gallery Night', aiItemIds: ['item-burgundy-skirt', 'item-ankle-boots'] },
    ])
  })

  it('moves to rating once the verdict starts, streaming the sentence', () => {
    const { seen, report } = collect()
    report({ title: 'A', itemIds: ['item-straight-jeans'], explanation: 'x', rating: {} })
    report({ title: 'A', itemIds: ['item-straight-jeans'], explanation: 'x', rating: { score: 6, verdict: 'Safe and' } })
    expect(seen.map((p) => [p.stage, p.verdict])).toEqual([
      ['rating', undefined],
      ['rating', 'Safe and'],
    ])
  })

  it('never goes backwards when the model starts its answer over; the retry shows once it catches up', () => {
    const { seen, report } = collect()
    report({ title: 'A', itemIds: ['item-straight-jeans'], rating: { verdict: 'Fine.' } })
    report({ title: 'A' })
    report({ title: 'B', itemIds: ['item-straight-jeans'] })
    report({ title: 'B', itemIds: ['item-straight-jeans'], rating: { verdict: 'Fin' } })
    report({ title: 'B', itemIds: ['item-straight-jeans'], rating: { verdict: 'Fine, but' } })
    expect(seen.map((p) => [p.title, p.verdict])).toEqual([
      ['A', 'Fine.'],
      ['B', 'Fine, but'],
    ])
  })

  it('stays quiet when nothing changed or nothing usable arrived', () => {
    const { seen, report } = collect()
    report(undefined)
    report({})
    report('nonsense')
    report({ title: 'A' })
    report({ title: 'A', itemIds: [] })
    expect(seen).toHaveLength(1)
  })

  it('never puts a dress on top of picked separates', () => {
    const seen: StyleProgress[] = []
    const report = styleProgressReporter({ ...request, fillCategories: ['dresses', 'shoes'] }, (p) => seen.push(p))
    report({ itemIds: ['item-little-black-dress', 'item-red-heels'] })
    expect(seen.at(-1)!.aiItemIds).toEqual(['item-red-heels'])
  })

  it('is a no-op without a listener', () => {
    expect(() => styleProgressReporter({ ...request, fillCategories: [] })({ title: 'A' })).not.toThrow()
  })
})
