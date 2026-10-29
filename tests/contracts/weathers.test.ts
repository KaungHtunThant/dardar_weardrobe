import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { DemoPlaceDirectory, DemoPlaceLocator, DemoWeatherProvider, FORECAST_DAYS } from '#shared/weather/DemoWeather'
import { CachedWeatherProvider } from '../../server/weather/CachedWeatherProvider'
import { GeoJsPlaceLocator } from '../../server/weather/GeoJsPlaceLocator'
import { OpenMeteoPlaceDirectory } from '../../server/weather/OpenMeteoPlaceDirectory'
import { OpenMeteoWeather } from '../../server/weather/OpenMeteoWeather'
import { CONTRACT_TODAY, placeDirectoryContract, placeLocatorContract, weatherProviderContract } from './weather.contract'

const fixture = (name: string) => readFileSync(new URL(`../fixtures/weather/${name}`, import.meta.url), 'utf8')
const json = (body: string, status = 200) => new Response(body, { status, headers: { 'content-type': 'application/json' } })

/**
 * Plays Open-Meteo and GeoJS from recorded answers. Like the real forecast API, it refuses
 * dates outside its window with a 400.
 */
const fakeFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
  init?.signal?.throwIfAborted()
  const url = new URL(String(input))
  if (url.hostname === 'api.open-meteo.com') {
    const date = url.searchParams.get('start_date')!
    const ahead = (Date.parse(date) - Date.parse(CONTRACT_TODAY)) / 86_400_000
    if (ahead < -92 || ahead >= FORECAST_DAYS)
      return json(JSON.stringify({ error: true, reason: "Parameter 'start_date' is out of allowed range from 2026-07-30 to 2026-11-14" }), 400)
    return json(fixture('open-meteo-forecast-london.json').replaceAll('2026-10-30', date))
  }
  if (url.hostname === 'geocoding-api.open-meteo.com')
    return json(url.searchParams.get('name') === 'London' ? fixture('open-meteo-search-london.json') : '{"generationtime_ms":0.1}')
  if (url.hostname === 'get.geojs.io') return json(fixture('geojs-geo.json'))
  return new Response('not found', { status: 404 })
}) as unknown as typeof fetch

const demoNow = () => new Date(`${CONTRACT_TODAY}T09:00:00`)

weatherProviderContract('DemoWeatherProvider', () => new DemoWeatherProvider(demoNow))
weatherProviderContract('OpenMeteoWeather', () => new OpenMeteoWeather({ fetch: fakeFetch }))
weatherProviderContract('CachedWeatherProvider(OpenMeteoWeather)', () => new CachedWeatherProvider(new OpenMeteoWeather({ fetch: fakeFetch })))
placeDirectoryContract('DemoPlaceDirectory', () => new DemoPlaceDirectory())
placeDirectoryContract('OpenMeteoPlaceDirectory', () => new OpenMeteoPlaceDirectory({ fetch: fakeFetch }))
placeLocatorContract('DemoPlaceLocator', () => new DemoPlaceLocator())
placeLocatorContract('GeoJsPlaceLocator', () => new GeoJsPlaceLocator({ fetch: fakeFetch }))

const london = { name: 'London', region: 'England', country: 'United Kingdom', latitude: 51.5085, longitude: -0.1257, timezone: 'Europe/London' }

describe('OpenMeteoWeather', () => {
  it('reads the recorded forecast: weather code, temperatures, rain chance and wind', async () => {
    expect(await new OpenMeteoWeather({ fetch: fakeFetch }).forecast(london, CONTRACT_TODAY)).toEqual({
      date: CONTRACT_TODAY,
      place: 'London, United Kingdom',
      condition: 'partly-cloudy',
      summary: 'Mainly clear',
      tempMin: 10.7,
      tempMax: 16.1,
      feelsLikeMin: 9.6,
      feelsLikeMax: 14,
      precipitationChance: 0,
      windMax: 11.2,
    })
  })

  it('asks for that one day in the place\'s own time zone', async () => {
    const spy = vi.fn(fakeFetch)
    await new OpenMeteoWeather({ fetch: spy as unknown as typeof fetch }).forecast(london, CONTRACT_TODAY)
    const url = new URL(String(spy.mock.calls[0]![0]))
    expect(url.searchParams.get('latitude')).toBe('51.5085')
    expect(url.searchParams.get('start_date')).toBe(CONTRACT_TODAY)
    expect(url.searchParams.get('end_date')).toBe(CONTRACT_TODAY)
    expect(url.searchParams.get('timezone')).toBe('Europe/London')
  })

  it('maps WMO codes to skies, and fills a missing rain chance with 0', async () => {
    const answer = (code: number) =>
      (async () => json(fixture('open-meteo-forecast-london.json').replace('"precipitation_probability_max":[0]', '"precipitation_probability_max":[null]').replace('"weather_code":[1]', `"weather_code":[${code}]`))) as unknown as typeof fetch
    const sky = async (code: number) => (await new OpenMeteoWeather({ fetch: answer(code) }).forecast(london, CONTRACT_TODAY))!
    expect((await sky(0)).condition).toBe('clear')
    expect((await sky(45)).condition).toBe('fog')
    expect((await sky(53)).condition).toBe('drizzle')
    expect((await sky(63)).summary).toBe('Rain')
    expect((await sky(81)).condition).toBe('rain')
    expect((await sky(75)).condition).toBe('snow')
    expect((await sky(95)).condition).toBe('storm')
    expect((await sky(63)).precipitationChance).toBe(0)
  })

  it('fails loudly on a server error (the caller decides to carry on without weather)', async () => {
    const down = (async () => new Response('oops', { status: 503 })) as unknown as typeof fetch
    await expect(new OpenMeteoWeather({ fetch: down }).forecast(london, CONTRACT_TODAY)).rejects.toThrow(/503/)
  })
})

describe('OpenMeteoPlaceDirectory', () => {
  it('keeps the region and time zone, and asks for a handful of English results', async () => {
    const spy = vi.fn(fakeFetch)
    const places = await new OpenMeteoPlaceDirectory({ fetch: spy as unknown as typeof fetch }).search('  London ')
    expect(places[0]).toMatchObject({ name: 'London', region: 'England', country: 'United Kingdom', timezone: 'Europe/London' })
    expect(places[0]!.latitude).toBeCloseTo(51.5085, 3)
    expect(places[1]).toMatchObject({ name: 'London', region: 'Ontario', country: 'Canada' })
    const url = new URL(String(spy.mock.calls[0]![0]))
    expect(url.searchParams.get('name')).toBe('London')
    expect(url.searchParams.get('language')).toBe('en')
  })
})

describe('GeoJsPlaceLocator', () => {
  it('reads the city, region and coordinates (sent as strings)', async () => {
    expect(await new GeoJsPlaceLocator({ fetch: fakeFetch }).locate()).toEqual({
      name: 'Paris',
      region: 'Île-de-France',
      country: 'France',
      latitude: 48.8534,
      longitude: 2.3488,
      timezone: 'Europe/Paris',
    })
  })

  it("can't tell without a city or coordinates", async () => {
    const vague = (async () => json('{"country":"France","ip":"203.0.113.7"}')) as unknown as typeof fetch
    expect(await new GeoJsPlaceLocator({ fetch: vague }).locate()).toBeNull()
  })
})

describe('CachedWeatherProvider', () => {
  const day = { date: CONTRACT_TODAY, place: 'London', condition: 'clear', summary: 'Clear sky', tempMin: 1, tempMax: 2, feelsLikeMin: 0, feelsLikeMax: 1, precipitationChance: 0, windMax: 3 } as const

  it('asks once per place and day while the answer is fresh, and again after', async () => {
    let now = 0
    const inner = { forecast: vi.fn(async () => ({ ...day })) }
    const cached = new CachedWeatherProvider(inner, { ttlMs: 1000, now: () => now })
    await Promise.all([cached.forecast(london, CONTRACT_TODAY), cached.forecast(london, CONTRACT_TODAY)])
    await cached.forecast(london, CONTRACT_TODAY)
    expect(inner.forecast).toHaveBeenCalledTimes(1)
    await cached.forecast(london, '2026-10-31')
    expect(inner.forecast).toHaveBeenCalledTimes(2)
    now = 1001
    await cached.forecast(london, CONTRACT_TODAY)
    expect(inner.forecast).toHaveBeenCalledTimes(3)
  })

  it('remembers a failure briefly, so an offline computer is not asked to wait on every page', async () => {
    let now = 0
    const inner = { forecast: vi.fn(async () => Promise.reject(new Error('offline'))) }
    const cached = new CachedWeatherProvider(inner, { failureTtlMs: 100, now: () => now })
    await expect(cached.forecast(london, CONTRACT_TODAY)).rejects.toThrow('offline')
    await expect(cached.forecast(london, CONTRACT_TODAY)).rejects.toThrow('offline')
    expect(inner.forecast).toHaveBeenCalledTimes(1)
    now = 101
    await expect(cached.forecast(london, CONTRACT_TODAY)).rejects.toThrow('offline')
    expect(inner.forecast).toHaveBeenCalledTimes(2)
  })

  it('never caches a cancelled request', async () => {
    const inner = { forecast: vi.fn(async (_p: unknown, _d: string, o?: { signal?: AbortSignal }) => (o?.signal?.throwIfAborted(), { ...day })) }
    const cached = new CachedWeatherProvider(inner)
    const c = new AbortController()
    c.abort()
    await expect(cached.forecast(london, CONTRACT_TODAY, { signal: c.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(await cached.forecast(london, CONTRACT_TODAY)).toEqual(day)
  })
})
