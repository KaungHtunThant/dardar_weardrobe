export interface ImageProcessor {
  /** Returns a PNG of the garment only, with a transparent background. */
  removeBackground(image: Uint8Array, mimeType: string): Promise<Uint8Array>
}
