import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEMO_PLACES } from '#shared/weather/DemoWeather'
import { localIsoDate } from '#shared/utils/date'
import { useWeatherStore } from '~/stores/weather'
import { setupTestGateway } from '../helpers'

const london = DEMO_PLACES.find((p) => p.name === 'London')!
const today = localIsoDate(new Date())

describe('weather store', () => {
  let gateway: ReturnType<typeof setupTestGateway>
  beforeEach(() => {
    gateway = setupTestGateway()
  })

  it('has no forecast until the user has a city', async () => {
    const store = useWeatherStore()
    await store.load(today)
    expect(store.forecast).toBeNull()
    expect(store.loaded).toBe(true)
  })

  it("loads the day's forecast once, and again after forget()", async () => {
    await gateway.updateSettings({ location: london })
    const spy = vi.spyOn(gateway, 'getWeather')
    const store = useWeatherStore()
    await store.load(today)
    await store.load(today)
    expect(store.forecast?.place).toBe('London, United Kingdom')
    expect(spy).toHaveBeenCalledTimes(1)
    store.forget()
    expect(store.forecast).toBeNull()
    await store.load(today)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('stays quiet when the weather is unavailable', async () => {
    vi.spyOn(gateway, 'getWeather').mockRejectedValue(new Error('offline'))
    const store = useWeatherStore()
    await store.load(today)
    expect(store.forecast).toBeNull()
  })

  it('finds cities and guesses where the user is', async () => {
    const store = useWeatherStore()
    expect((await store.searchPlaces('lond'))[0]?.name).toBe('London')
    expect((await store.locate())?.name).toBe('Paris')
    vi.spyOn(gateway, 'locatePlace').mockRejectedValue(new Error('offline'))
    expect(await store.locate()).toBeNull()
  })
})
