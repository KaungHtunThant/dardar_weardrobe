import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { DEMO_PLACES } from '#shared/weather/DemoWeather'
import { useHomePage } from '~/services/pages/index.service'
import { useSettingsStore } from '~/stores/settings'
import { useGapsStore } from '~/stores/gaps'
import { setupTestGateway } from '../../helpers'

const tokyo = DEMO_PLACES.find((p) => p.name === 'Tokyo')!

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

  it('suggests where the user lives on first launch, and saves it with the welcome', async () => {
    const vm = useHomePage()
    await vm.init()
    await flushPromises()
    expect(vm.welcomePlace.value).toBe('Paris, France')
    expect(vm.welcomeLocating.value).toBe(false)
    expect(vm.pickingPlace.value).toBe(false)
    await vm.dismissWelcome()
    expect((await gateway.getSettings()).location).toMatchObject({ name: 'Paris' })
  })

  it('lets the user pick another city before saying hello', async () => {
    const vm = useHomePage()
    await vm.init()
    await flushPromises()
    vm.changePlace()
    expect(vm.pickingPlace.value).toBe(true)
    vm.pickPlace(tokyo)
    expect(vm.welcomePlace.value).toBe('Tokyo, Japan')
    expect(vm.pickingPlace.value).toBe(false)
    await vm.dismissWelcome()
    expect((await gateway.getSettings()).location).toMatchObject({ name: 'Tokyo' })
  })

  it("offers the city search when it can't tell where the user is, and can be skipped", async () => {
    vi.spyOn(gateway, 'locatePlace').mockResolvedValue(null)
    const vm = useHomePage()
    await vm.init()
    await flushPromises()
    expect(vm.welcomePlace.value).toBeNull()
    expect(vm.pickingPlace.value).toBe(true)
    await vm.dismissWelcome()
    const settings = await gateway.getSettings()
    expect(settings).toMatchObject({ welcomed: true, location: null })
  })

  it("asks for today's look again once the city is saved, so it suits the weather", async () => {
    const vm = useHomePage()
    await vm.init()
    await flushPromises()
    const spy = vi.spyOn(gateway, 'getTodayLook')
    await vm.dismissWelcome()
    expect(spy).toHaveBeenCalledWith('2026-10-28')
  })

  it("shows the weather today's look was styled for, or invites the user to add a city", async () => {
    await gateway.updateSettings({ welcomed: true })
    const vm = useHomePage()
    await vm.init()
    expect(vm.todayWeather.value).toBeNull()
    expect(vm.askForCity.value).toBe(true)

    await useSettingsStore().update({ location: tokyo })
    const look = (await gateway.generateLook({ fillCategories: ['tops', 'bottoms'] }))!
    vi.spyOn(gateway, 'getTodayLook').mockResolvedValue({ ...look, dailyPickDate: '2026-10-28' })
    const again = useHomePage()
    await again.init()
    expect(again.askForCity.value).toBe(false)
    expect(again.todayWeather.value).toMatchObject({ icon: expect.stringMatching(/^lucide:/), label: expect.stringContaining('in Tokyo, Japan') })
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

  it('lists what the wardrobe is missing, with the pieces each would be worn with', async () => {
    const vm = useHomePage()
    await vm.init()
    expect(vm.gapsLoading.value).toBe(false)
    const blazer = vm.gaps.value.find((g) => g.name === 'Tailored Blazer')!
    expect(blazer).toMatchObject({ category: 'Outerwear', icon: 'lucide:cloud-sun', colors: 'black' })
    expect(blazer.reason).toBeTruthy()
    expect(blazer.pairsWith.length).toBeGreaterThan(0)
    expect(blazer.pairsWith[0]).toMatchObject({ id: expect.any(String), name: expect.any(String), cleanImage: expect.any(String) })
    expect(vm.showGaps.value).toBe(true)
  })

  it('rewrites the missing pieces for the city saved with the welcome', async () => {
    const vm = useHomePage()
    await vm.init()
    await flushPromises()
    await vm.dismissWelcome()
    expect((await gateway.getWardrobeGaps())?.place).toBe('Paris, France')
    expect(useGapsStore().report?.place).toBe('Paris, France')
  })

  it('asks the stylist again for the missing pieces', async () => {
    const vm = useHomePage()
    await vm.init()
    const spy = vi.spyOn(gateway, 'refreshWardrobeGaps')
    await vm.refreshGaps()
    expect(spy).toHaveBeenCalled()
  })

  it('has no missing-pieces section for an empty wardrobe', async () => {
    setupTestGateway({ items: [], styleMatches: [] })
    const vm = useHomePage()
    await vm.init()
    expect(vm.showGaps.value).toBe(false)
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
