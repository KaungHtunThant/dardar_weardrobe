export interface ProcessedImage {
  bytes: Uint8Array
  mimeType: string
}

export interface ImageProcessor {
  /** Returns the garment only, on a transparent background. */
  removeBackground(image: Uint8Array, mimeType: string): Promise<ProcessedImage>
}
