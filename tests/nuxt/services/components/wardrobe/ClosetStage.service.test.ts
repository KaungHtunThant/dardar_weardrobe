import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { seedItems } from '#shared/fixtures/seed'
import { DOOR_MS, useClosetStage } from '~/services/components/wardrobe/ClosetStage.service'

const tops = seedItems.filter((i) => i.category === 'tops')

describe('ClosetStage service', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('opens the doors, then closes them before asking to leave', () => {
    const emit = vi.fn()
    const vm = useClosetStage({ category: 'tops', items: tops }, emit)
    expect(vm.doorsOpen.value).toBe(false)
    vm.open()
    expect(vm.doorsOpen.value).toBe(true)

    vm.requestClose()
    expect(vm.doorsOpen.value).toBe(false)
    expect(emit).not.toHaveBeenCalled()
    vi.advanceTimersByTime(DOOR_MS)
    expect(emit).toHaveBeenCalledWith('close')
  })

  it('ignores repeated close requests while closing', () => {
    const emit = vi.fn()
    const vm = useClosetStage({ category: 'tops', items: tops }, emit)
    vm.open()
    vm.requestClose()
    vm.requestClose()
    vi.advanceTimersByTime(DOOR_MS)
    expect(emit).toHaveBeenCalledTimes(1)
  })

  it('labels the closet with its category and count', () => {
    const vm = useClosetStage({ category: 'shoes', items: [seedItems[0]!] }, vi.fn())
    expect(vm.title.value).toBe('Shoes')
    expect(vm.countLabel.value).toBe('1 piece')
  })
})
