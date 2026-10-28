import { describe, expect, it } from 'vitest'
import { CATEGORIES, CategoryIdSchema, getCategory } from '#shared/models/category'
import { ItemSchema, ItemDetailsSchema } from '#shared/models/item'
import { StyleMatchSchema } from '#shared/models/styleMatch'

const validItem = {
  id: 'item-1',
  name: 'White Linen Tee',
  category: 'tops',
  originalImage: '/garments/a.svg',
  cleanImage: '/garments/a.svg',
  colors: ['white'],
  seasons: ['summer'],
  occasions: ['casual'],
  createdAt: '2026-10-01T10:00:00.000Z',
}

describe('Category', () => {
  it('lists the seven closets in display order', () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual([
      'tops',
      'bottoms',
      'dresses',
      'outerwear',
      'shoes',
      'bags',
      'accessories',
    ])
    expect([...CATEGORIES].sort((a, b) => a.order - b.order)).toEqual(CATEGORIES)
  })

  it('looks a category up by id', () => {
    expect(getCategory('shoes').label).toBe('Shoes')
  })

  it('rejects unknown categories', () => {
    expect(CategoryIdSchema.safeParse('hats').success).toBe(false)
  })
})

describe('Item', () => {
  it('parses a valid item and defaults isFavourite to false', () => {
    const item = ItemSchema.parse(validItem)
    expect(item.isFavourite).toBe(false)
  })

  it('trims the name and requires it', () => {
    expect(ItemSchema.parse({ ...validItem, name: '  Tee  ' }).name).toBe('Tee')
    expect(ItemSchema.safeParse({ ...validItem, name: '   ' }).success).toBe(false)
  })

  it('requires both images', () => {
    expect(ItemSchema.safeParse({ ...validItem, cleanImage: '' }).success).toBe(false)
  })

  it('rejects unknown seasons and occasions', () => {
    expect(ItemSchema.safeParse({ ...validItem, seasons: ['monsoon'] }).success).toBe(false)
    expect(ItemSchema.safeParse({ ...validItem, occasions: ['gala'] }).success).toBe(false)
  })

  it('details schema covers only what the user types in the form', () => {
    const details = ItemDetailsSchema.parse({ name: 'Tee', category: 'tops' })
    expect(details).toEqual({ name: 'Tee', category: 'tops', colors: [], seasons: [], occasions: [] })
    expect(Object.keys(ItemDetailsSchema.shape)).not.toContain('cleanImage')
  })

  it('drops empty optional text instead of storing blanks', () => {
    const details = ItemDetailsSchema.parse({ name: 'Tee', category: 'tops', brand: '  ', notes: '' })
    expect(details.brand).toBeUndefined()
    expect(details.notes).toBeUndefined()
  })
})

describe('StyleMatch', () => {
  const look = {
    id: 'look-1',
    title: 'Parisian Weekend',
    itemIds: ['item-1', 'item-2'],
    explanation: 'Relaxed layers in neutral tones.',
    createdAt: '2026-10-20T09:00:00.000Z',
  }

  it('parses a look and defaults isFavourite to false', () => {
    expect(StyleMatchSchema.parse(look).isFavourite).toBe(false)
  })

  it('needs at least one item', () => {
    expect(StyleMatchSchema.safeParse({ ...look, itemIds: [] }).success).toBe(false)
  })

  it('accepts an optional prompt and daily pick date', () => {
    const parsed = StyleMatchSchema.parse({ ...look, prompt: 'cozy', dailyPickDate: '2026-10-28' })
    expect(parsed.dailyPickDate).toBe('2026-10-28')
    expect(StyleMatchSchema.safeParse({ ...look, dailyPickDate: 'tomorrow' }).success).toBe(false)
  })
})
