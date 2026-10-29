import { describe, expect, it } from 'vitest'
import { StyleMatchSchema, StyleRatingSchema } from '#shared/models/styleMatch'
import { StyleRequestSchema } from '#shared/models/styleRequest'

const rating = {
  score: 6,
  verdict: 'Wearable, forgettable.',
  works: ['Disciplined palette.'],
  fails: ['No shoes.'],
  fixes: [{ addItemId: 'item-white-sneakers', note: 'Add the white sneakers.' }],
}

describe('StyleRating', () => {
  it('accepts a 1–10 integer score with verdict, works, fails and fixes', () => {
    expect(StyleRatingSchema.parse(rating).score).toBe(6)
  })

  it('rejects scores outside 1–10 or fractional', () => {
    expect(StyleRatingSchema.safeParse({ ...rating, score: 0 }).success).toBe(false)
    expect(StyleRatingSchema.safeParse({ ...rating, score: 11 }).success).toBe(false)
    expect(StyleRatingSchema.safeParse({ ...rating, score: 7.5 }).success).toBe(false)
  })

  it('needs a note on every fix', () => {
    expect(StyleRatingSchema.safeParse({ ...rating, fixes: [{ addItemId: 'x', note: '' }] }).success).toBe(false)
  })
})

describe('StyleMatch with rating', () => {
  it('stores the rating and which pieces the AI added', () => {
    const look = StyleMatchSchema.parse({
      id: 'look-x',
      title: 'Test',
      itemIds: ['a', 'b'],
      aiItemIds: ['b'],
      explanation: '',
      rating,
      createdAt: '2026-10-28T10:00:00.000Z',
    })
    expect(look.aiItemIds).toEqual(['b'])
    expect(look.rating?.verdict).toBe('Wearable, forgettable.')
  })
})

describe('StyleRequest', () => {
  it('defaults to no pins and no AI categories, and trims the prompt', () => {
    const req = StyleRequestSchema.parse({ fillCategories: ['tops'], prompt: '  brunch  ' })
    expect(req).toEqual({ pinnedItemIds: [], fillCategories: ['tops'], dressForWeather: true, prompt: 'brunch' })
  })

  it('drops a blank prompt', () => {
    expect(StyleRequestSchema.parse({ pinnedItemIds: ['a'], prompt: '   ' }).prompt).toBeUndefined()
  })

  it('needs at least one picked piece or one category for the AI', () => {
    const result = StyleRequestSchema.safeParse({ pinnedItemIds: [], fillCategories: [] })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Pick a piece or let the AI fill at least one category')
  })

  it('rejects duplicate picks and unknown categories', () => {
    expect(StyleRequestSchema.safeParse({ pinnedItemIds: ['a', 'a'] }).success).toBe(false)
    expect(StyleRequestSchema.safeParse({ fillCategories: ['hats'] }).success).toBe(false)
  })
})
