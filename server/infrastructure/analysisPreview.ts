import sharp from 'sharp'
import type { StoredImage } from '#shared/contracts/ImageStore'

/** Claude vision gains nothing above this size (long edge), and the API caps image size. */
const LONG_EDGE = 1568

/** An upright JPEG of the photo, small enough to send to Claude quickly. */
export async function analysisPreview(bytes: Uint8Array, _mimeType: string): Promise<StoredImage> {
  const out = await sharp(Buffer.from(bytes))
    .rotate()
    .resize({ width: LONG_EDGE, height: LONG_EDGE, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 85 })
    .toBuffer()
  return { bytes: new Uint8Array(out), mimeType: 'image/jpeg' }
}
