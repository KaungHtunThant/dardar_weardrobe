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

/** What the stylist has produced so far while a look is being styled. */
export interface StyleProgress {
  /** reading: the request is in; picking: pieces are being chosen; rating: the verdict is being written. */
  stage: 'reading' | 'picking' | 'rating'
  title?: string
  /** The AI's additions so far: real wardrobe pieces from the allowed categories only. */
  aiItemIds: string[]
  /** The verdict sentence as far as it has been written. */
  verdict?: string
}

export interface StyleCallOptions {
  /** Aborting stops the work (the request is cancelled or the process killed) and rejects with an AbortError. */
  signal?: AbortSignal
  /** Called as the answer takes shape; providers that can't stream may never call it. */
  onProgress?: (progress: StyleProgress) => void
}

/** An AI backend that completes and rates looks from existing clothes (mock, Claude CLI, Claude API, …). */
export interface StyleAdvisor {
  suggestLook(request: StyleAdvisorRequest, options?: StyleCallOptions): Promise<StyleSuggestion>
}
