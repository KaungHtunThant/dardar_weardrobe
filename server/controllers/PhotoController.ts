import { readMultipartFormData, type H3Event } from 'h3'
import { ValidationError } from '#shared/errors'
import type { PhotoService } from '../services/PhotoService'

export class PhotoController {
  constructor(private readonly photos: PhotoService) {}

  /** Multipart upload with a single `photo` file field. */
  async upload(event: H3Event) {
    const parts = (await readMultipartFormData(event)) ?? []
    const file = parts.find((p) => p.name === 'photo' && p.filename !== undefined)
    if (!file) throw new ValidationError('Please choose a photo to upload.')
    return this.photos.process(new Uint8Array(file.data), file.type ?? 'application/octet-stream')
  }
}
