import type { Item } from '../models/item'

export interface StyleRequest {
  wardrobe: readonly Item[]
  /** Optional custom prompt from the user; without it the advisor picks a style itself. */
  prompt?: string
}

export interface StyleSuggestion {
  title: string
  itemIds: string[]
  explanation: string
}

/** An AI backend that style-matches existing clothes (Claude CLI, Claude API, …). */
export interface StyleAdvisor {
  suggestLook(request: StyleRequest): Promise<StyleSuggestion>
}
