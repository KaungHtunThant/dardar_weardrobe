import type { ClothesLabel } from '../utils/clothesLabels'

/** Raw RGB pixels, row by row. */
export interface RawImage {
  data: Uint8Array
  width: number
  height: number
}

/** One value (0–255) per pixel. */
export interface Mask {
  data: Uint8Array
  width: number
  height: number
}

/** Tells clothes from skin, hair and background in a photo of a person. */
export interface ClothesSegmenter {
  /** How likely each pixel shows one of `labels` (0–255), at the segmenter's own resolution. */
  garmentMask(image: RawImage, labels: readonly ClothesLabel[]): Promise<Mask>
}
