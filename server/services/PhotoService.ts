import type { ImageStore } from '#shared/contracts/ImageStore'
import type { ProcessedPhoto } from '#shared/contracts/WardrobeGateway'
import { ValidationError } from '#shared/errors'
import type { GarmentPipeline } from './GarmentPipeline'

const MAX_BYTES = 20 * 1024 * 1024

/** Checks an uploaded photo is a usable image (type, not empty, at most 20 MB). */
export function validatePhoto(bytes: Uint8Array, mimeType: string) {
  if (!mimeType.startsWith('image/')) throw new ValidationError('Please choose an image file.')
  if (bytes.byteLength === 0) throw new ValidationError('That photo is empty.')
  if (bytes.byteLength > MAX_BYTES) throw new ValidationError('That photo is too large (20 MB max).')
}

/** Replacing a piece's photo: done while the user waits, through the same pipeline as new uploads. */
export class PhotoService {
  constructor(
    private readonly images: ImageStore,
    private readonly pipeline: GarmentPipeline,
  ) {}

  /** Saves the photo, then finds and cuts out the garment. */
  async process(bytes: Uint8Array, mimeType: string): Promise<ProcessedPhoto> {
    validatePhoto(bytes, mimeType)
    const originalImage = await this.images.save(bytes, mimeType)
    const { cleanImage, backgroundRemoved } = await this.pipeline.prepare(originalImage)
    return { originalImage, cleanImage, backgroundRemoved }
  }
}
