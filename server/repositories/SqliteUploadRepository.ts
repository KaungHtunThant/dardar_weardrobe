import { asc, eq } from 'drizzle-orm'
import type { UploadRepository } from '#shared/contracts/UploadRepository'
import type { Upload } from '#shared/models/upload'
import type { Db } from '../database/connection'
import { uploads } from '../database/schema'

export class SqliteUploadRepository implements UploadRepository {
  constructor(private readonly db: Db) {}

  async findAll() {
    return (await this.db.select().from(uploads).orderBy(asc(uploads.createdAt), asc(uploads.id))) as Upload[]
  }

  async findById(id: string) {
    return ((await this.db.select().from(uploads).where(eq(uploads.id, id)).get()) as Upload | undefined) ?? null
  }

  async insert(upload: Upload) {
    await this.db.insert(uploads).values(upload)
    return upload
  }

  async update(upload: Upload) {
    const { id, ...rest } = upload
    await this.db.update(uploads).set(rest).where(eq(uploads.id, id))
    return upload
  }

  async delete(id: string) {
    const existed = (await this.findById(id)) !== null
    if (existed) await this.db.delete(uploads).where(eq(uploads.id, id))
    return existed
  }
}
