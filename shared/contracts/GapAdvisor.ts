import type { GapSuggestion } from '../models/gap'
import type { Item } from '../models/item'
import type { DayWeather } from '../models/weather'

export interface GapAdvisorRequest {
  wardrobe: readonly Item[]
  /** Today's forecast where the user lives (its place tells the climate), if known. */
  weather?: DayWeather | null
}

export interface GapCallOptions {
  /** Aborting stops the work and rejects with an AbortError. */
  signal?: AbortSignal
}

/** Finds the pieces a wardrobe is missing (offline rules, Claude CLI, Claude API). */
export interface GapAdvisor {
  /** Most important first, at most MAX_GAPS; each pairs only with pieces from the wardrobe. */
  suggestGaps(request: GapAdvisorRequest, options?: GapCallOptions): Promise<GapSuggestion[]>
}
