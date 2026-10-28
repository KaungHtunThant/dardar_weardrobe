export interface StoredImage {
  bytes: Uint8Array
  mimeType: string
}

export interface ImageStore {
  /** Persists image bytes and returns a reference the UI can display. */
  save(bytes: Uint8Array, mimeType: string): Promise<string>
  /** The image behind a reference (or bare id), or null if there is none. */
  read(ref: string): Promise<StoredImage | null>
  /** Deletes a stored image; references it doesn't own (e.g. demo images) are ignored. */
  delete(ref: string): Promise<void>
}
