import type { CategoryId } from '../models/category'
import type { Item } from '../models/item'
import type { StyleRating } from '../models/styleMatch'

export interface StyleAdvisorRequest {
  wardrobe: readonly Item[]
  /** Pieces the user picked; they always stay in the look. */
  pinnedItemIds: readonly string[]
  /** Categories the AI may add one piece to (skipped where the user already picked). */
  fillCategories: readonly CategoryId[]
  /** Optional custom prompt; without it the advisor picks a style itself. */
  prompt?: string
}

export interface StyleSuggestion {
  title: string
  /** Pinned pieces first, then the AI's additions. */
  itemIds: string[]
  /** The pieces the AI added. */
  aiItemIds: string[]
  explanation: string
  /** Brutally honest verdict on the final look. */
  rating: StyleRating
}

/** An AI backend that completes and rates looks from existing clothes (mock, Claude CLI, Claude API, …). */
export interface StyleAdvisor {
  suggestLook(request: StyleAdvisorRequest): Promise<StyleSuggestion>
}
