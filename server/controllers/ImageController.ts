import { getRouterParam, send, setResponseHeader, type H3Event } from 'h3'
import type { ImageStore } from '#shared/contracts/ImageStore'
import { NotFoundError } from '#shared/errors'

export class ImageController {
  constructor(private readonly images: ImageStore) {}

  async show(event: H3Event) {
    const image = await this.images.read(getRouterParam(event, 'id') ?? '')
    if (!image) throw new NotFoundError('Image not found')
    // Stored images never change (new uploads get new ids).
    setResponseHeader(event, 'Cache-Control', 'private, max-age=31536000, immutable')
    return send(event, Buffer.from(image.bytes), image.mimeType)
  }
}
