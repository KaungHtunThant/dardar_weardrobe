import { describe, expect, it } from 'vitest'
import { seedItems } from '#shared/fixtures/seed'
import { useItemCard } from '~/services/components/wardrobe/ItemCard.service'

describe('ItemCard service', () => {
  it('shows brand and colours', () => {
    const item = seedItems.find((i) => i.id === 'item-trench-coat')!
    expect(useItemCard({ item }).meta.value).toBe('Burberry · camel')
  })

  it('leaves out a missing brand', () => {
    const item = { ...seedItems[0]!, brand: undefined, colors: ['white', 'cream'] }
    expect(useItemCard({ item }).meta.value).toBe('white, cream')
  })
})
