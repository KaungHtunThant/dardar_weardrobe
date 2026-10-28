import { describe, expect, it, vi } from 'vitest'
import { countByCategory } from '#shared/utils/wardrobe'
import { seedItems } from '#shared/fixtures/seed'
import { useCategoryBar } from '~/services/components/wardrobe/CategoryBar.service'

describe('CategoryBar service', () => {
  const counts = countByCategory(seedItems)

  it('offers "All" first, then every category with its count', () => {
    const vm = useCategoryBar({ counts, selected: 'all' }, vi.fn())
    expect(vm.options.value[0]).toMatchObject({ id: 'all', label: 'All', count: seedItems.length })
    expect(vm.options.value.map((o) => o.id)).toEqual(['all', 'tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'bags', 'accessories'])
    expect(vm.options.value.find((o) => o.id === 'shoes')!.count).toBe(4)
  })

  it('emits the chosen category', () => {
    const emit = vi.fn()
    useCategoryBar({ counts, selected: 'all' }, emit).select('bags')
    expect(emit).toHaveBeenCalledWith('select', 'bags')
  })
})
