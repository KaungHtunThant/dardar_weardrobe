import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { useHomePage } from '~/services/pages/index.service'
import { setupTestGateway } from '../../helpers'

describe('home page service', () => {
  let gateway: ReturnType<typeof setupTestGateway>
  beforeEach(() => {
    gateway = setupTestGateway()
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

  it('welcomes the user to their stylist once, until they dismiss it', async () => {
    const vm = useHomePage()
    await vm.init()
    expect(vm.welcome.value).toMatchObject({ name: 'Dardar' })
    await vm.dismissWelcome()
    expect(vm.welcome.value).toBeNull()
    expect((await gateway.getSettings()).welcomed).toBe(true)
  })

  it("moves through the stylist's stages while today's look is being styled", async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    let finish: (look: null) => void = () => {}
    vi.spyOn(gateway, 'getTodayLook').mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)))
    const vm = useHomePage()
    const pending = vm.init()
    await flushPromises()
    expect(vm.todayLoading.value).toBe(true)
    expect(vm.todayStage.value).toMatch(/reading your wardrobe/i)
    vi.advanceTimersByTime(5_000)
    expect(vm.todayStage.value).toMatch(/choosing/i)
    vi.advanceTimersByTime(10_000)
    expect(vm.todayStage.value).toMatch(/verdict/i)
    finish(null)
    await pending
    expect(vm.todayLoading.value).toBe(false)
    expect(vm.todayStage.value).toMatch(/reading your wardrobe/i)
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
