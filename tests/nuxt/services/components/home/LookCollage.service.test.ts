import { describe, expect, it } from 'vitest'
import { seedItems } from '#shared/fixtures/seed'
import { collageLayout, orderForCollage } from '~/services/components/home/LookCollage.service'

const byId = (...slugs: string[]) => slugs.map((s) => seedItems.find((i) => i.id === `item-${s}`)!)

describe('LookCollage service', () => {
  it('puts the hero garment first: dress, then top, then outerwear', () => {
    const ordered = orderForCollage(byId('white-sneakers', 'trench-coat', 'linen-tee', 'straight-jeans'))
    expect(ordered.map((i) => i.category)).toEqual(['tops', 'outerwear', 'bottoms', 'shoes'])
  })

  it('gives the hero tile two rows when there are 4+ pieces', () => {
    const layout = collageLayout(5)
    expect(layout.grid).toContain('grid-rows-2')
    expect(layout.grid).toContain('grid-cols-[1.5fr_1fr_1fr]')
    expect(layout.tiles[0]).toContain('row-span-2')
    expect(layout.tiles).toHaveLength(5)
  })

  it('lays out small looks in a single row', () => {
    expect(collageLayout(2).grid).toContain('grid-cols-2')
    expect(collageLayout(2).tiles.every((t) => !t.includes('row-span-2'))).toBe(true)
  })

  it('caps the collage at five tiles', () => {
    expect(collageLayout(8).tiles).toHaveLength(5)
  })
})
