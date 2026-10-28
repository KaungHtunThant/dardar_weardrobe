import type { ImageProcessor } from '#shared/contracts/ImageProcessor'
import type { ImageStore } from '#shared/contracts/ImageStore'
import type { ProcessedPhoto } from '#shared/contracts/WardrobeGateway'
import { ValidationError } from '#shared/errors'

const MAX_BYTES = 20 * 1024 * 1024

export class PhotoService {
  constructor(
    private readonly images: ImageStore,
    private readonly processor: ImageProcessor,
  ) {}

  /** Saves the photo, removes its background and saves the garment-only image. */
  async process(bytes: Uint8Array, mimeType: string): Promise<ProcessedPhoto> {
    if (!mimeType.startsWith('image/')) throw new ValidationError('Please choose an image file.')
    if (bytes.byteLength === 0) throw new ValidationError('That photo is empty.')
    if (bytes.byteLength > MAX_BYTES) throw new ValidationError('That photo is too large (20 MB max).')

    const originalImage = await this.images.save(bytes, mimeType)
    try {
      const clean = await this.processor.removeBackground(bytes, mimeType)
      return { originalImage, cleanImage: await this.images.save(clean.bytes, clean.mimeType), backgroundRemoved: true }
    } catch (e) {
      console.warn('[dardar] background removal failed, keeping the original photo:', e)
      return { originalImage, cleanImage: originalImage, backgroundRemoved: false }
    }
  }
}
