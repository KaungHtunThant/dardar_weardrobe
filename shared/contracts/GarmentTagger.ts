import type { ItemDetails } from '../models/item'

/** What a tagger may suggest for the add-item form. */
export type DetailsSuggestion = Partial<Pick<ItemDetails, 'name' | 'category' | 'colors' | 'seasons' | 'occasions'>>

export interface GarmentImage {
  bytes: Uint8Array
  mimeType: string
  /** Local file path, for tools that read files (the Claude CLI); null if not on disk. */
  path: string | null
}

/** Looks at a garment photo and suggests its details (Claude vision, or nothing offline). */
export interface GarmentTagger {
  suggestDetails(image: GarmentImage): Promise<DetailsSuggestion>
}
