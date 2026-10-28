import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { useHomePage } from '~/services/pages/index.service'
import { setupTestGateway } from '../../helpers'

describe('home page service', () => {
  beforeEach(() => {
    setupTestGateway()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 28, 9, 0))
  })
  afterEach(() => vi.useRealTimers())

  it('starts loading and exposes all three sections once loaded', async () => {
    const vm = useHomePage()
    expect(vm.loading.value).toBe(true)
    await vm.init()
    expect(vm.loading.value).toBe(false)
    expect(vm.today.value?.look.title).toBeTruthy()
    expect(vm.today.value?.items.length).toBeGreaterThan(0)
    expect(vm.recent.value.length).toBeGreaterThan(0)
    expect(vm.favourites.value.every((f) => f.look.isFavourite)).toBe(true)
  })

  it('formats today for the hero eyebrow', async () => {
    const vm = useHomePage()
    expect(vm.todayLabel).toBe('Wednesday, 28 October')
  })

  it('toggles a favourite and updates the favourites section', async () => {
    const vm = useHomePage()
    await vm.init()
    const before = vm.favourites.value.length
    await vm.toggleFavourite('look-date-night')
    await flushPromises()
    expect(vm.favourites.value.length).toBe(before + 1)
  })
})
