/** A garment whose brightest parts (99th percentile luma) are below this was shot in dim light. */
const DIM = 170
/** Dim garments are lifted so their brightest parts reach about this, by at most MAX_GAIN. */
const TARGET = 210
const MAX_GAIN = 1.4
const VISIBLE = 128

const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b

/**
 * Evens out the lighting of a cut-out garment without changing its colour: a garment shot in dim
 * light is brightened with one gain on every channel (hue and saturation stay); a well-exposed
 * one is left exactly as it is, because the colour is what the wardrobe and the stylist rely on.
 */
export function evenTone(rgb: Uint8Array, alpha: Uint8Array): Uint8Array {
  const hist = new Uint32Array(256)
  let n = 0
  for (let i = 0; i < alpha.length; i++)
    if (alpha[i]! >= VISIBLE) {
      hist[Math.round(luma(rgb[i * 3]!, rgb[i * 3 + 1]!, rgb[i * 3 + 2]!))]!++
      n++
    }
  if (!n) return rgb
  let seen = 0
  let bright = 255
  for (let v = 0; v < 256; v++)
    if ((seen += hist[v]!) >= n * 0.99) {
      bright = v
      break
    }
  if (bright >= DIM || bright === 0) return rgb
  const gain = Math.min(MAX_GAIN, TARGET / bright)
  const out = new Uint8Array(rgb.length)
  for (let i = 0; i < rgb.length; i++) out[i] = Math.min(255, Math.round(rgb[i]! * gain))
  return out
}
