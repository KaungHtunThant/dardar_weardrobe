import type { FocusBox } from '../utils/focusBox'
import type { DetailsSuggestion, GarmentImage } from './GarmentTagger'

/** What the stylist saw in an uploaded photo. */
export interface GarmentAnalysis {
  /** The garment the photo is about, or null when it can't tell (the whole photo is used). */
  focus: FocusBox | null
  /** A person is wearing it (so skin, hair and other clothes must be cut away). */
  worn: boolean
  details: DetailsSuggestion
}

export const NO_ANALYSIS: GarmentAnalysis = Object.freeze({ focus: null, worn: false, details: Object.freeze({}) }) as GarmentAnalysis

/** Looks at the original upload: which garment it is about, where it is, and what it is. */
export interface GarmentAnalyst {
  analyze(image: GarmentImage, options?: { signal?: AbortSignal }): Promise<GarmentAnalysis>
}
