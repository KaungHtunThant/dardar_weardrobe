import type { CategoryId } from '../models/category'

/** Every digitalized garment is a 5:6 portrait, like the sample garments. */
export const STUDIO_CANVAS = { width: 800, height: 960 } as const
const PADDING = 0.1
/** Shoes and bags rest low in the frame, with their bottom edge here. */
const GROUND = 0.88
const MAX_UPSCALE = 3

export interface Placement {
  width: number
  height: number
  left: number
  top: number
}

/** Where a cut-out of `width`×`height` goes on the studio canvas: as large as fits the padding, centred. */
export function studioPlacement(width: number, height: number, category?: CategoryId): Placement {
  const innerW = STUDIO_CANVAS.width * (1 - 2 * PADDING)
  const innerH = STUDIO_CANVAS.height * (1 - 2 * PADDING)
  const scale = Math.min(innerW / width, innerH / height, MAX_UPSCALE)
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))
  const left = Math.round((STUDIO_CANVAS.width - w) / 2)
  const grounded = category === 'shoes' || category === 'bags'
  const top = grounded ? Math.round(STUDIO_CANVAS.height * GROUND) - h : Math.round((STUDIO_CANVAS.height - h) / 2)
  return { width: w, height: h, left, top }
}
