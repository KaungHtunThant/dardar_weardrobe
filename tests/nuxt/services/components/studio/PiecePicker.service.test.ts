import { describe, expect, it, vi } from 'vitest'
import { seedItems } from '#shared/fixtures/seed'
import { usePiecePicker } from '~/services/components/studio/PiecePicker.service'

describe('PiecePicker service', () => {
  it('browses one category at a time, starting with tops', () => {
    const vm = usePiecePicker({ items: seedItems, pinnedIds: [] }, vi.fn())
    expect(vm.category.value).toBe('tops')
    expect(vm.visible.value.every((i) => i.category === 'tops')).toBe(true)
    vm.setCategory('shoes')
    expect(vm.visible.value).toHaveLength(4)
  })

  it('counts picks per category for the tabs', () => {
    const vm = usePiecePicker({ items: seedItems, pinnedIds: ['item-linen-tee', 'item-black-tee', 'item-red-heels'] }, vi.fn())
    expect(vm.tabs.value.find((t) => t.id === 'tops')!.picked).toBe(2)
    expect(vm.tabs.value.find((t) => t.id === 'shoes')!.picked).toBe(1)
  })

  it('emits toggles', () => {
    const emit = vi.fn()
    usePiecePicker({ items: seedItems, pinnedIds: [] }, emit).toggle('item-linen-tee')
    expect(emit).toHaveBeenCalledWith('toggle', 'item-linen-tee')
  })
})
