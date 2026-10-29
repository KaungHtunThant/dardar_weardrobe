import type { WeatherCallOptions, WeatherProvider } from '#shared/contracts/WeatherProvider'
import type { DayWeather, Place } from '#shared/models/weather'

export interface WeatherCacheOptions {
  /** How long a forecast is reused (forecasts move slowly within a day). */
  ttlMs?: number
  /** How long a failure is remembered, so an offline computer isn't asked to wait again on every page. */
  failureTtlMs?: number
  now?: () => number
}

interface Entry {
  until: number
  value: Promise<DayWeather | null>
}

/** Remembers forecasts per place and day, and shares one request between callers asking at once. */
export class CachedWeatherProvider implements WeatherProvider {
  private readonly entries = new Map<string, Entry>()
  private readonly ttlMs: number
  private readonly failureTtlMs: number
  private readonly now: () => number

  constructor(
    private readonly inner: WeatherProvider,
    options: WeatherCacheOptions = {},
  ) {
    this.ttlMs = options.ttlMs ?? 30 * 60_000
    this.failureTtlMs = options.failureTtlMs ?? 2 * 60_000
    this.now = options.now ?? Date.now
  }

  forecast(place: Place, date: string, options: WeatherCallOptions = {}): Promise<DayWeather | null> {
    if (options.signal?.aborted) return this.inner.forecast(place, date, options)
    const key = `${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}:${date}`
    const hit = this.entries.get(key)
    if (hit && hit.until > this.now()) return abortable(hit.value, options.signal)

    // Shared by everyone asking, so one caller giving up doesn't cancel it for the others.
    const entry: Entry = { until: Number.POSITIVE_INFINITY, value: this.inner.forecast(place, date) }
    for (const [k, e] of this.entries) if (e.until <= this.now()) this.entries.delete(k)
    this.entries.set(key, entry)
    entry.value.then(
      () => (entry.until = this.now() + this.ttlMs),
      (e: unknown) => {
        // A cancelled request says nothing about the weather service: forget it.
        if ((e as Error)?.name === 'AbortError') this.entries.delete(key)
        else entry.until = this.now() + this.failureTtlMs
      },
    )
    return abortable(entry.value, options.signal)
  }
}

/** The shared answer, or an AbortError as soon as this caller's signal fires. */
function abortable<T>(value: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return value
  return new Promise<T>((resolve, reject) => {
    const stop = () => reject(signal.reason)
    signal.addEventListener('abort', stop, { once: true })
    value.then(resolve, reject).finally(() => signal.removeEventListener('abort', stop))
  })
}
