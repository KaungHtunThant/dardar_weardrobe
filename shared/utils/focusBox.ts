/** Where the garment is in a photo, as fractions (0–1) of its width and height. */
export interface FocusBox {
  x: number
  y: number
  w: number
  h: number
}

export interface PixelRect {
  left: number
  top: number
  width: number
  height: number
}

/** Below this share of the photo a box is more likely a mistake than a garment. */
const MIN_AREA = 0.01
/** A box this close to the whole frame says nothing worth cropping to. */
const WHOLE_FRAME = 0.98

const round = (n: number) => Math.round(n * 10_000) / 10_000

/**
 * Tidies a model's bounding box (`{ x, y, width, height }`): reads percentages as fractions,
 * clamps it to the photo, and returns null when it is missing, tiny or covers everything.
 */
export function toFocusBox(raw: unknown): FocusBox | null {
  if (!raw || typeof raw !== 'object') return null
  const { x, y, width, height } = raw as Record<string, unknown>
  let v = [x, y, width, height]
  if (!v.every((n): n is number => typeof n === 'number' && Number.isFinite(n))) return null
  if ((v as number[]).some((n) => n > 1) && (v as number[]).every((n) => n <= 100)) v = (v as number[]).map((n) => n / 100)
  const [bx, by, bw, bh] = v as number[]
  const x0 = Math.max(0, bx!)
  const y0 = Math.max(0, by!)
  const x1 = Math.min(1, bx! + bw!)
  const y1 = Math.min(1, by! + bh!)
  const w = x1 - x0
  const h = y1 - y0
  if (w <= 0 || h <= 0 || w * h < MIN_AREA) return null
  if (w >= WHOLE_FRAME && h >= WHOLE_FRAME) return null
  return { x: round(x0), y: round(y0), w: round(w), h: round(h) }
}

/** The box in whole pixels, grown by `margin` (a share of the box's own size) and kept inside the image. */
export function focusRect(box: FocusBox, imageWidth: number, imageHeight: number, margin = 0.08): PixelRect {
  const mx = box.w * imageWidth * margin
  const my = box.h * imageHeight * margin
  const left = Math.max(0, Math.round(box.x * imageWidth - mx))
  const top = Math.max(0, Math.round(box.y * imageHeight - my))
  const right = Math.min(imageWidth, Math.round((box.x + box.w) * imageWidth + mx))
  const bottom = Math.min(imageHeight, Math.round((box.y + box.h) * imageHeight + my))
  return { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) }
}
