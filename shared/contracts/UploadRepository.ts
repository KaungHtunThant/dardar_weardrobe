import type { Upload } from '../models/upload'

export interface UploadRepository {
  /** Oldest first: the order they are processed in. */
  findAll(): Promise<Upload[]>
  findById(id: string): Promise<Upload | null>
  insert(upload: Upload): Promise<Upload>
  update(upload: Upload): Promise<Upload>
  /** Returns whether something was deleted. */
  delete(id: string): Promise<boolean>
}
