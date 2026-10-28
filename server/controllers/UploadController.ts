import { getRouterParam, readBody, readMultipartFormData, setResponseStatus, type H3Event } from 'h3'
import type { UploadService } from '../services/UploadService'

export class UploadController {
  constructor(private readonly uploads: UploadService) {}

  list() {
    return this.uploads.list()
  }

  /** Multipart with one or more `photo` files and an optional `category` (the closet they were added from). */
  async enqueue(event: H3Event) {
    const parts = (await readMultipartFormData(event)) ?? []
    const photos = parts
      .filter((p) => p.name === 'photo' && p.filename !== undefined)
      .map((p) => ({ bytes: new Uint8Array(p.data), mimeType: p.type ?? 'application/octet-stream' }))
    const category = parts.find((p) => p.name === 'category' && p.filename === undefined)?.data.toString('utf8')
    const queued = await this.uploads.enqueue(photos, { categoryHint: category })
    setResponseStatus(event, 202)
    return queued
  }

  retry(event: H3Event) {
    return this.uploads.retry(getRouterParam(event, 'id') ?? '')
  }

  async save(event: H3Event) {
    return this.uploads.save(getRouterParam(event, 'id') ?? '', await readBody(event))
  }

  async discard(event: H3Event) {
    await this.uploads.discard(getRouterParam(event, 'id') ?? '')
    return { deleted: true }
  }
}
