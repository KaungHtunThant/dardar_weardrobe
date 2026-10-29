import { describe, expect, it } from 'vitest'
import { DayWeatherSchema } from '#shared/models/weather'
import { localIsoDate } from '#shared/utils/date'
import { GeoJsPlaceLocator } from '../../server/weather/GeoJsPlaceLocator'
import { OpenMeteoPlaceDirectory } from '../../server/weather/OpenMeteoPlaceDirectory'
import { OpenMeteoWeather } from '../../server/weather/OpenMeteoWeather'

// Real calls to Open-Meteo and GeoJS (free, but they need the network). Opt in with RUN_LIVE=1.
describe.runIf(process.env.RUN_LIVE === '1')('weather services (live)', () => {
  it("finds London and reads today's forecast there", async () => {
    const [london] = await new OpenMeteoPlaceDirectory().search('London')
    expect(london).toMatchObject({ name: 'London', country: 'United Kingdom', timezone: 'Europe/London' })
    const today = localIsoDate(new Date())
    const weather = await new OpenMeteoWeather().forecast(london!, today)
    expect(() => DayWeatherSchema.parse(weather)).not.toThrow()
    console.log('[live] London today:', weather)
  })

  it('guesses where this computer is', async () => {
    const place = await new GeoJsPlaceLocator().locate()
    expect(place?.name).toBeTruthy()
  })
})
