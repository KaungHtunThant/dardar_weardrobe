export interface ImageStore {
  /** Persists image bytes and returns a reference the UI can display. */
  save(bytes: Uint8Array, mimeType: string): Promise<string>
  read(ref: string): Promise<Uint8Array>
}
