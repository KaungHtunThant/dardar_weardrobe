import type { GapAdvisor, GapAdvisorRequest } from '#shared/contracts/GapAdvisor'
import type { GapReportRepository } from '#shared/contracts/GapReportRepository'
import type { ItemRepository } from '#shared/contracts/ItemRepository'
import type { GapReport, GapSuggestion } from '#shared/models/gap'
import { wardrobeKey } from '#shared/utils/gaps'
import { placeLabel } from '#shared/utils/weather'
import type { Clock } from './clock'
import type { DailyWeather } from './WeatherService'

export interface GapServiceOptions {
  items: ItemRepository
  reports: GapReportRepository
  /** The chosen stylist, resolved per request so a settings change takes effect at once. */
  advisor: () => Promise<GapAdvisor>
  /** The offline rules: used when the chosen stylist fails (and they are what "Offline" resolves to). */
  fallback: GapAdvisor
  /** The forecast where the user lives tells the stylist the climate. */
  weather?: DailyWeather
  clock: Clock
}

/** "What your wardrobe is missing": written by the stylist, kept until the wardrobe or the city changes, or the user asks again. */
export class GapService {
  /** The work in flight; callers asking meanwhile share it. `force`: it asks the stylist whatever is kept. */
  private pending: { force: boolean; promise: Promise<GapReport | null> } | null = null

  constructor(private readonly o: GapServiceOptions) {}

  /** The kept report while it fits the wardrobe and the city; otherwise a new one. Null for an empty wardrobe. */
  current(): Promise<GapReport | null> {
    return this.run(false)
  }

  /** Asks the stylist again, whatever is kept. */
  refresh(): Promise<GapReport | null> {
    return this.run(true)
  }

  private run(force: boolean) {
    if (this.pending && (this.pending.force || !force)) return this.pending.promise
    const before = this.pending?.promise
    const promise = (async () => {
      await before?.catch(() => {})
      return this.keptOrNew(force)
    })()
    const entry = { force, promise }
    this.pending = entry
    promise.catch(() => {}).finally(() => this.pending === entry && (this.pending = null))
    return promise
  }

  private async keptOrNew(force: boolean) {
    if (!force) {
      const [wardrobe, kept, place] = await Promise.all([this.o.items.findAll(), this.o.reports.current(), this.place()])
      if (kept && kept.wardrobeKey === wardrobeKey(wardrobe) && kept.place === place) return kept
    }
    return this.compose()
  }

  private async place() {
    const place = await this.o.weather?.place()
    return place ? placeLabel(place) : null
  }

  private async compose(): Promise<GapReport | null> {
    const wardrobe = await this.o.items.findAll()
    if (wardrobe.length === 0) return null
    const request: GapAdvisorRequest = { wardrobe, weather: (await this.o.weather?.today()) ?? null }

    const advisor = await this.o.advisor()
    let gaps: GapSuggestion[]
    let by: GapReport['by'] = advisor === this.o.fallback ? 'offline' : 'claude'
    try {
      gaps = await advisor.suggestGaps(request)
    } catch (e) {
      console.warn('[dardar] missing pieces: stylist failed, using offline rules:', e)
      gaps = await this.o.fallback.suggestGaps(request)
      by = 'offline'
    }
    return this.o.reports.save({ gaps, wardrobeKey: wardrobeKey(wardrobe), place: await this.place(), by, createdAt: this.o.clock.now().toISOString() })
  }
}
