import { describe, expect, it } from 'vitest'
import { seedItems } from '#shared/fixtures/seed'
import { slotFor, wear } from '#shared/utils/outfit'

const item = (slug: string) => seedItems.find((i) => i.id === `item-${slug}`)!
const ids = (list: { id: string }[]) => list.map((i) => i.id.replace('item-', ''))

describe('slotFor', () => {
  it('maps clothing categories to body slots', () => {
    expect(slotFor(item('linen-tee'))).toBe('torso')
    expect(slotFor(item('trench-coat'))).toBe('outer')
    expect(slotFor(item('sage-slip-dress'))).toBe('dress')
    expect(slotFor(item('straight-jeans'))).toBe('legs')
    expect(slotFor(item('ankle-boots'))).toBe('feet')
    expect(slotFor(item('camel-tote'))).toBe('hand')
  })

  it('places accessories by what they are', () => {
    expect(slotFor(item('straw-hat'))).toBe('head')
    expect(slotFor(item('sunglasses'))).toBe('face')
    expect(slotFor(item('gold-necklace'))).toBe('neck')
    expect(slotFor(item('silk-scarf'))).toBe('neck')
    expect(slotFor({ ...item('gold-necklace'), name: 'Silver Bangle' })).toBe('wrist')
  })
})

describe('wear', () => {
  it('replaces whatever is in the same slot', () => {
    expect(ids(wear([item('linen-tee'), item('straight-jeans')], item('black-tee')))).toEqual(['straight-jeans', 'black-tee'])
  })

  it('a dress takes off tops and bottoms, and separates take off a dress', () => {
    expect(ids(wear([item('linen-tee'), item('straight-jeans'), item('white-sneakers')], item('sage-slip-dress')))).toEqual([
      'white-sneakers',
      'sage-slip-dress',
    ])
    expect(ids(wear([item('sage-slip-dress'), item('white-sneakers')], item('straight-jeans')))).toEqual([
      'white-sneakers',
      'straight-jeans',
    ])
  })

  it('lets accessories in different slots coexist', () => {
    expect(ids(wear([item('straw-hat')], item('gold-necklace')))).toEqual(['straw-hat', 'gold-necklace'])
  })

  it('does not mutate the outfit', () => {
    const outfit = [item('linen-tee')]
    wear(outfit, item('black-tee'))
    expect(ids(outfit)).toEqual(['linen-tee'])
  })
})
