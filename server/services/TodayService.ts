import type { ItemRepository } from '#shared/contracts/ItemRepository'
import type { StyleAdvisor } from '#shared/contracts/StyleAdvisor'
import type { StyleMatchRepository } from '#shared/contracts/StyleMatchRepository'
import type { CategoryId } from '#shared/models/category'
import type { Season } from '#shared/models/item'
import type { StyleMatch } from '#shared/models/styleMatch'
import { lookFromSuggestion } from '#shared/utils/looks'
import type { Clock } from './clock'

/** Northern-hemisphere season for a YYYY-MM-DD date. */
export function seasonOf(date: string): Season {
  const month = Number(date.slice(5, 7))
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
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
    const existing = (await this.looks.findAll()).find((l) => l.dailyPickDate === date)
    if (existing) return existing
    const wardrobe = await this.items.findAll()
    if (wardrobe.length === 0) return null

    const season = seasonOf(date)
    const weekday = new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })
    const fill: CategoryId[] = ['tops', 'bottoms', 'shoes', 'bags', 'accessories']
    if (season === 'autumn' || season === 'winter') fill.push('outerwear')
    const request = { wardrobe, pinnedItemIds: [], fillCategories: fill, prompt: `An everyday ${season} outfit for ${weekday}` }

    let suggestion
    try {
      suggestion = await (await this.advisor()).suggestLook(request)
    } catch (e) {
      console.warn("[dardar] today's look: stylist failed, using offline rules:", e)
      suggestion = await this.fallback.suggestLook(request)
    }
    const look = { ...lookFromSuggestion(suggestion, {}, `look-${this.clock.newId()}`, this.clock.now()), dailyPickDate: date }
    return this.looks.insert(look)
  }
}
