import type { PixelRect } from './focusBox'

/** Pixels at or below this alpha count as transparent. */
const VISIBLE = 8
/** The clothes probability ramps from "not clothes" to "clothes" between these (0–255). */
const RAMP_FROM = 120
const RAMP_TO = 200

/** The smallest rectangle holding every visible pixel, or null if nothing is visible. */
export function alphaBounds(alpha: Uint8Array, width: number, height: number): PixelRect | null {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (alpha[y * width + x]! > VISIBLE) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
  return maxX < 0 ? null : { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

/** Share of the image (0–1) that is visible. */
export function alphaCoverage(alpha: Uint8Array): number {
  let n = 0
  for (const a of alpha) if (a > VISIBLE) n++
  return alpha.length ? n / alpha.length : 0
}

/** The background matte, kept only where the clothes mask (a probability, 0–255) says "clothes". */
export function combineAlpha(matte: Uint8Array, clothes: Uint8Array): Uint8Array {
  const out = new Uint8Array(matte.length)
  for (let i = 0; i < matte.length; i++) {
    const p = Math.min(255, Math.max(0, ((clothes[i]! - RAMP_FROM) * 255) / (RAMP_TO - RAMP_FROM)))
    out[i] = Math.round((matte[i]! * p) / 255)
  }
  return out
}

/** Shrinks the visible area by one pixel (3×3 minimum), which removes coloured halos along the edge. */
export function erodeAlpha(alpha: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(alpha.length)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let min = 255
      for (let dy = -1; dy <= 1 && min > 0; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          const a = nx < 0 || ny < 0 || nx >= width || ny >= height ? 0 : alpha[ny * width + nx]!
          if (a < min) min = a
        }
      out[y * width + x] = min
    }
  return out
}
