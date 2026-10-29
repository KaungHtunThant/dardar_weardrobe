import type { ItemRepository } from '#shared/contracts/ItemRepository'
import type { StyleAdvisor } from '#shared/contracts/StyleAdvisor'
import type { StyleMatchRepository } from '#shared/contracts/StyleMatchRepository'
import type { CategoryId } from '#shared/models/category'
import type { Season } from '#shared/models/item'
import type { StyleMatch } from '#shared/models/styleMatch'
import type { DayWeather } from '#shared/models/weather'
import { lookFromSuggestion } from '#shared/utils/looks'
import { feelOf, isWet } from '#shared/utils/weather'
import type { Clock } from './clock'
import type { DailyWeather } from './WeatherService'

const NORTHERN: Season[] = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter']

/** The season of a YYYY-MM-DD date; south of the equator (negative latitude) it is turned around. */
export function seasonOf(date: string, latitude = 0): Season {
  const month = Number(date.slice(5, 7))
  return NORTHERN[(month - 1 + (latitude < 0 ? 6 : 0)) % 12]!
}

/** A coat on a cold or wet day; without a forecast, in the colder half of the year. */
function wantsOuterwear(weather: DayWeather | null, season: Season) {
  if (weather) return isWet(weather) || ['cold', 'cool'].includes(feelOf(weather))
  return season === 'autumn' || season === 'winter'
}

/** "Today's recommendation": one look per day, styled by the chosen stylist, then kept. */
export class TodayService {
  private readonly inFlight = new Map<string, Promise<StyleMatch | null>>()

  constructor(
    private readonly items: ItemRepository,
    private readonly looks: StyleMatchRepository,
    private readonly advisor: () => Promise<StyleAdvisor>,
    /** Used when the chosen stylist fails, so Home always has something. */
    private readonly fallback: StyleAdvisor,
    private readonly clock: Clock,
    /** The forecast where the user lives; without it, the calendar decides. */
    private readonly weather?: DailyWeather,
  ) {}

  today(date: string): Promise<StyleMatch | null> {
    let pending = this.inFlight.get(date)
    if (!pending) {
      pending = this.findOrStyle(date).finally(() => this.inFlight.delete(date))
      this.inFlight.set(date, pending)
    }
    return pending
  }

  private async findOrStyle(date: string) {
    const weather = (await this.weather?.forDay(date)) ?? null
    const existing = (await this.looks.findAll()).find((l) => l.dailyPickDate === date)
    if (existing && !movedSince(existing, weather)) return existing
    const wardrobe = await this.items.findAll()
    if (wardrobe.length === 0) return null

    const season = seasonOf(date, (await this.weather?.place())?.latitude)
    const weekday = new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })
    const fill: CategoryId[] = ['tops', 'bottoms', 'shoes', 'bags', 'accessories']
    if (wantsOuterwear(weather, season)) fill.push('outerwear')
    // With a forecast the stylist dresses for the actual day, not the calendar.
    const prompt = weather ? `An everyday outfit for ${weekday}` : `An everyday ${season} outfit for ${weekday}`
    const request = { wardrobe, pinnedItemIds: [], fillCategories: fill, prompt, weather }

    let suggestion
    try {
      suggestion = await (await this.advisor()).suggestLook(request)
    } catch (e) {
      console.warn("[dardar] today's look: stylist failed, using offline rules:", e)
      suggestion = await this.fallback.suggestLook(request)
    }
    const look = { ...lookFromSuggestion(suggestion, { weather }, `look-${this.clock.newId()}`, this.clock.now()), dailyPickDate: date }
    const saved = await this.looks.insert(look)
    // One recommendation per day: the pick styled for the old city goes.
    if (existing) await this.looks.delete(existing.id)
    return saved
  }
}

/**
 * The user has set or changed their city since today's pick was styled, so it no longer fits the day.
 * A pick they favourited stays, and without a forecast now there's nothing better to offer.
 */
function movedSince(pick: StyleMatch, weather: DayWeather | null) {
  return Boolean(weather) && !pick.isFavourite && pick.weather?.place !== weather!.place
}
