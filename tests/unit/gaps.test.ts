import { describe, expect, it } from 'vitest'
import { GapReportSchema, GapSuggestionSchema } from '#shared/models/gap'
import { wardrobeKey } from '#shared/utils/gaps'

const gap = { category: 'outerwear', name: 'Black Tailored Blazer', reason: 'Your work trousers have nothing to sharpen them.', colors: ['black'], pairsWithItemIds: ['item-black-trousers'] }

describe('wardrobe gaps', () => {
  it('validates a suggested piece', () => {
    expect(GapSuggestionSchema.parse(gap)).toEqual(gap)
    expect(() => GapSuggestionSchema.parse({ ...gap, category: 'hats' })).toThrow()
    expect(() => GapSuggestionSchema.parse({ ...gap, name: ' ' })).toThrow()
    expect(() => GapSuggestionSchema.parse({ ...gap, pairsWithItemIds: ['a', 'b', 'c', 'd', 'e'] })).toThrow()
  })

  it('validates a report', () => {
    const report = { gaps: [gap], wardrobeKey: 'k', place: 'Oslo, Norway', by: 'claude', createdAt: '2026-10-30T08:00:00.000Z' }
    expect(GapReportSchema.parse(report)).toEqual(report)
    expect(GapReportSchema.parse({ ...report, place: undefined }).place).toBeNull()
    expect(() => GapReportSchema.parse({ ...report, gaps: Array(7).fill(gap) })).toThrow()
  })

  it('keys a wardrobe by its pieces, in any order', () => {
    expect(wardrobeKey([{ id: 'b' }, { id: 'a' }])).toBe(wardrobeKey([{ id: 'a' }, { id: 'b' }]))
    expect(wardrobeKey([{ id: 'a' }])).not.toBe(wardrobeKey([{ id: 'a' }, { id: 'c' }]))
    expect(wardrobeKey([])).toBe(wardrobeKey([]))
  })
})
