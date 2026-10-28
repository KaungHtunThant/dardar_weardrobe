import type { ImageProcessor, ProcessedImage } from '#shared/contracts/ImageProcessor'

interface Imgly {
  removeBackground(image: Blob, config?: object): Promise<Blob>
}

/** Loaded on first use: the ONNX runtime and model are heavy and most requests never need them. */
const loadImgly = async (): Promise<Imgly> => (await import('@imgly/background-removal-node')) as unknown as Imgly

/**
 * Local, offline background removal (@imgly/background-removal-node, ONNX). Claude can't edit
 * images, so this is what produces the "garment only" picture.
 */
export class ImglyImageProcessor implements ImageProcessor {
  private imgly: Promise<Imgly> | null = null

  constructor(private readonly load: () => Promise<Imgly> = loadImgly) {}

  async removeBackground(image: Uint8Array, mimeType: string): Promise<ProcessedImage> {
    // Vector art has no photographic background to remove.
    if (mimeType === 'image/svg+xml') return { bytes: image, mimeType }
    this.imgly ??= this.load()
    const imgly = await this.imgly
    const result = await imgly.removeBackground(new Blob([image as BlobPart], { type: mimeType }), {
      model: 'medium',
      output: { format: 'image/png' },
    })
    return { bytes: new Uint8Array(await result.arrayBuffer()), mimeType: 'image/png' }
  }
}
