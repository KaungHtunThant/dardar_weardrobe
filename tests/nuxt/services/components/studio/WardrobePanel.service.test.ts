import { describe, expect, it, vi } from 'vitest'
import { seedItems } from '#shared/fixtures/seed'
import { useWardrobePanel } from '~/services/components/studio/WardrobePanel.service'

describe('WardrobePanel service', () => {
  it('offers All plus every category, flagging ones being worn', () => {
    const vm = useWardrobePanel({ items: seedItems, category: 'all', wornIds: ['item-red-heels'], wornCategories: ['shoes'] }, vi.fn())
    expect(vm.tabs.value.map((t) => t.id)).toEqual(['all', 'tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'bags', 'accessories'])
    expect(vm.tabs.value.find((t) => t.id === 'shoes')!.worn).toBe(true)
    expect(vm.tabs.value.find((t) => t.id === 'tops')!.worn).toBe(false)
  })

  it('emits category changes and wear toggles', () => {
    const emit = vi.fn()
    const vm = useWardrobePanel({ items: seedItems, category: 'all', wornIds: [], wornCategories: [] }, emit)
    vm.select('bags')
    vm.toggle('item-camel-tote')
    expect(emit).toHaveBeenCalledWith('select-category', 'bags')
    expect(emit).toHaveBeenCalledWith('toggle', 'item-camel-tote')
  })

  it('knows which pieces are worn', () => {
    const vm = useWardrobePanel({ items: seedItems, category: 'all', wornIds: ['item-red-heels'], wornCategories: ['shoes'] }, vi.fn())
    expect(vm.isWorn('item-red-heels')).toBe(true)
  })
})

describe('WardrobePanel details', () => {
  it('asks to open a piece in the detail sheet', () => {
    const emit = vi.fn()
    useWardrobePanel({ items: seedItems, category: 'all', wornIds: [], wornCategories: [] }, emit).details('item-red-heels')
    expect(emit).toHaveBeenCalledWith('details', 'item-red-heels')
  })
})
