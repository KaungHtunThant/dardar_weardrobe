import sharp from 'sharp'
import type { ClothesSegmenter, RawImage } from '#shared/contracts/ClothesSegmenter'
import type { ImageProcessor, ProcessedImage, StudioHints } from '#shared/contracts/ImageProcessor'
import { alphaBounds, alphaCoverage, combineAlpha, erodeAlpha } from '#shared/utils/alpha'
import { clothesLabelsFor } from '#shared/utils/clothesLabels'
import { focusRect } from '#shared/utils/focusBox'
import { STUDIO_CANVAS, studioPlacement } from '#shared/utils/studioLayout'
import { evenTone } from '#shared/utils/tone'

/** Photos are worked on at most this size (long edge); the result is 800×960 anyway. */
const MAX_EDGE = 2048
/** A clothes mask covering less than this share of the crop is a miss, not a garment. */
const MIN_GARMENT = 0.03

export interface GarmentStudioOptions {
  /** Removes the background (imgly); returns an RGBA PNG of the same size. */
  matte: ImageProcessor
  /** Tells clothes from skin and hair; without it a worn garment keeps the person. */
  segmenter?: ClothesSegmenter
  log?: (message: string, error?: unknown) => void
}

/**
 * "Digitalizes" a garment photo the way the sample garments look:
 * crop to the garment the stylist found → remove the background → for worn garments keep only
 * clothes pixels (no skin, hair or other clothes) → clean edges, even tone → centre it on a
 * transparent 5:6 canvas with even padding. Claude can't edit images; every step here is local.
 */
export class GarmentStudioProcessor implements ImageProcessor {
  constructor(private readonly o: GarmentStudioOptions) {}

  private log(message: string, error?: unknown) {
    ;(this.o.log ?? ((m, e) => console.warn(`[dardar] ${m}`, e ?? '')))(message, error)
  }

  async removeBackground(image: Uint8Array, mimeType: string, hints: StudioHints = {}): Promise<ProcessedImage> {
    if (mimeType === 'image/svg+xml') return { bytes: image, mimeType }
    const crop = await this.cropToGarment(image, hints)
    const matte = await this.matte(crop)
    const alpha = hints.worn ? await this.clothesOnly(crop, matte, hints) : matte
    return { bytes: await this.finish(crop, alpha, hints), mimeType: 'image/png' }
  }

  /** Upright (EXIF), at most MAX_EDGE, cropped to the stylist's box plus a margin. */
  private async cropToGarment(image: Uint8Array, hints: StudioHints): Promise<RawImage> {
    const { data, info } = await sharp(Buffer.from(image))
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    if (!hints.focus) return { data, width: info.width, height: info.height }
    const r = focusRect(hints.focus, info.width, info.height)
    const out = await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } }).extract(r).raw().toBuffer()
    return { data: out, width: r.width, height: r.height }
  }

  /** The background remover's alpha, at the crop's size. */
  private async matte(crop: RawImage): Promise<Uint8Array> {
    const png = await sharp(crop.data, { raw: { width: crop.width, height: crop.height, channels: 3 } }).png().toBuffer()
    const matted = await this.o.matte.removeBackground(new Uint8Array(png), 'image/png')
    return sharp(Buffer.from(matted.bytes))
      .ensureAlpha()
      .resize(crop.width, crop.height, { fit: 'fill' })
      .extractChannel(3)
      .raw()
      .toBuffer()
      .then((b) => new Uint8Array(b))
  }

  /** Keeps the matte only where the segmenter sees clothes of this category; the matte alone if that fails. */
  private async clothesOnly(crop: RawImage, matte: Uint8Array, hints: StudioHints): Promise<Uint8Array> {
    if (!this.o.segmenter) return matte
    try {
      const mask = await this.o.segmenter.garmentMask(crop, clothesLabelsFor(hints.category))
      const full = await sharp(Buffer.from(mask.data), { raw: { width: mask.width, height: mask.height, channels: 1 } })
        .resize(crop.width, crop.height, { fit: 'fill', kernel: 'cubic' })
        .extractChannel(0)
        .raw()
        .toBuffer()
      const alpha = combineAlpha(matte, new Uint8Array(full))
      if (alphaCoverage(alpha) >= MIN_GARMENT) return alpha
      this.log('clothes segmentation found next to nothing; keeping the background matte')
    } catch (e) {
      this.log('clothes segmentation failed; keeping the background matte', e)
    }
    return matte
  }

  /** Clean edges, even tone, trimmed and centred on the studio canvas. */
  private async finish(crop: RawImage, rawAlpha: Uint8Array, hints: StudioHints): Promise<Uint8Array> {
    const eroded = erodeAlpha(rawAlpha, crop.width, crop.height)
    const alpha = new Uint8Array(
      await sharp(Buffer.from(eroded), { raw: { width: crop.width, height: crop.height, channels: 1 } }).blur(0.6).extractChannel(0).raw().toBuffer(),
    )
    const bounds = alphaBounds(alpha, crop.width, crop.height)
    if (!bounds) throw new Error('The cut-out has nothing in it.')
    const rgb = evenTone(crop.data, alpha)
    const rgba = Buffer.alloc(crop.width * crop.height * 4)
    for (let i = 0; i < alpha.length; i++) {
      rgba[i * 4] = rgb[i * 3]!
      rgba[i * 4 + 1] = rgb[i * 3 + 1]!
      rgba[i * 4 + 2] = rgb[i * 3 + 2]!
      rgba[i * 4 + 3] = alpha[i]!
    }
    const place = studioPlacement(bounds.width, bounds.height, hints.category)
    const garment = await sharp(rgba, { raw: { width: crop.width, height: crop.height, channels: 4 } })
      .extract(bounds)
      .resize(place.width, place.height, { fit: 'fill', kernel: 'lanczos3' })
      .png()
      .toBuffer()
    const out = await sharp({ create: { ...STUDIO_CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: garment, left: place.left, top: place.top }])
      .png({ compressionLevel: 9 })
      .toBuffer()
    return new Uint8Array(out)
  }
}
