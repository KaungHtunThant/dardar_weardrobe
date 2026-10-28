import type { ImageProcessor } from '#shared/contracts/ImageProcessor'

/** Keeps the photo as-is. Stand-in until the local background-removal model is wired in. */
export class PassThroughImageProcessor implements ImageProcessor {
  async removeBackground(image: Uint8Array, mimeType: string) {
    return { bytes: image, mimeType }
  }
}
