import { randomUUID } from 'node:crypto'
import { mkdirSync, rmSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ImageStore, StoredImage } from '#shared/contracts/ImageStore'

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
}
const MIME_TYPES = Object.fromEntries(Object.entries(EXTENSIONS).map(([mime, ext]) => [ext, mime]))
/** A stored file name: uuid + known extension. Anything else (e.g. "../") is rejected. */
const FILE_NAME = /^[a-f0-9-]{36}\.(png|jpg|webp|gif|avif|svg)$/

/** Images on disk, served by the API under `urlPrefix`. */
export class FsImageStore implements ImageStore {
  constructor(
    private readonly dir: string,
    private readonly urlPrefix = '/api/images/',
  ) {
    mkdirSync(dir, { recursive: true })
  }

  async save(bytes: Uint8Array, mimeType: string) {
    const name = `${randomUUID()}.${EXTENSIONS[mimeType] ?? 'png'}`
    await writeFile(join(this.dir, name), bytes)
    return `${this.urlPrefix}${name}`
  }

  async read(ref: string): Promise<StoredImage | null> {
    const name = ref.startsWith(this.urlPrefix) ? ref.slice(this.urlPrefix.length) : ref
    if (!FILE_NAME.test(name)) return null
    try {
      const bytes = new Uint8Array(await readFile(join(this.dir, name)))
      return { bytes, mimeType: MIME_TYPES[name.split('.').pop()!]! }
    } catch {
      return null
    }
  }

  async delete(ref: string) {
    const path = this.pathOf(ref)
    if (path) rmSync(path, { force: true })
  }

  /** Deletes every stored image. */
  async clear() {
    rmSync(this.dir, { recursive: true, force: true })
    mkdirSync(this.dir, { recursive: true })
  }

  /** Absolute path of a stored image (for local tools such as the Claude CLI). */
  pathOf(ref: string): string | null {
    const name = ref.startsWith(this.urlPrefix) ? ref.slice(this.urlPrefix.length) : ref
    return FILE_NAME.test(name) ? join(this.dir, name) : null
  }
}
