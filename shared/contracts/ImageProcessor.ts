import type { CategoryId } from '../models/category'
import type { FocusBox } from '../utils/focusBox'

export interface ProcessedImage {
  bytes: Uint8Array
  mimeType: string
}

/** What the stylist saw in the photo, so the right thing is cut out. */
export interface StudioHints {
  /** Where the garment is; the rest of the photo is cropped away. */
  focus?: FocusBox | null
  /** A person is wearing it: skin, hair and other clothes go too. */
  worn?: boolean
  category?: CategoryId
}

export interface ImageProcessor {
  /** Returns the garment only, on a transparent background. */
  removeBackground(image: Uint8Array, mimeType: string, hints?: StudioHints): Promise<ProcessedImage>
}
