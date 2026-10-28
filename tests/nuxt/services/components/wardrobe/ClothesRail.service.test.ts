import { describe, expect, it } from 'vitest'
import { storageFor, useClothesRail } from '~/services/components/wardrobe/ClothesRail.service'

describe('ClothesRail service', () => {
  it('hangs garments and shelves shoes, bags and accessories', () => {
    expect(storageFor('dresses')).toBe('hang')
    expect(storageFor('outerwear')).toBe('hang')
    expect(storageFor('shoes')).toBe('shelf')
    expect(storageFor('accessories')).toBe('shelf')
  })

  it('is safe to page before the carousel is mounted', () => {
    const vm = useClothesRail({ items: [], category: 'tops' })
    expect(vm.canPrev.value).toBe(false)
    expect(() => vm.next()).not.toThrow()
    expect(vm.storage.value).toBe('hang')
  })
})
