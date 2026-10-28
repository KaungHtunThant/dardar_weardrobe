import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ImageProcessor, ProcessedImage } from '#shared/contracts/ImageProcessor'

interface Imgly {
  removeBackground(image: Blob, config?: object): Promise<Blob>
}

/**
 * Where the imgly package keeps its model files (resources.json + chunks), as a file:// URL.
 * imgly's own default resolves `node_modules/…` against the working directory, which is wrong
 * in an installed app, so the path is taken from the package actually loaded.
 */
export function imglyPublicPath(): string {
  const pkg = '@imgly/background-removal-node'
  // Node's own module search paths, so it works whichever entry (cjs/mjs) the bundle kept.
  for (const nodeModules of createRequire(import.meta.url).resolve.paths(pkg) ?? []) {
    const dist = join(nodeModules, pkg, 'dist')
    if (existsSync(join(dist, 'resources.json'))) return `${pathToFileURL(dist).href}/`
  }
  throw new Error(`Background removal model files not found (${pkg}).`)
}

/** Loaded on first use: the ONNX runtime and model are heavy and most requests never need them. */
const loadImgly = async (): Promise<Imgly> => (await import('@imgly/background-removal-node')) as unknown as Imgly

/**
 * Local, offline background removal (@imgly/background-removal-node, ONNX). Claude can't edit
 * images, so this is what produces the "garment only" picture.
 */
export class ImglyImageProcessor implements ImageProcessor {
  private imgly: Promise<Imgly> | null = null

  constructor(
    private readonly load: () => Promise<Imgly> = loadImgly,
    private readonly publicPath: () => string = imglyPublicPath,
  ) {}

  async removeBackground(image: Uint8Array, mimeType: string): Promise<ProcessedImage> {
    // Vector art has no photographic background to remove.
    if (mimeType === 'image/svg+xml') return { bytes: image, mimeType }
    this.imgly ??= this.load()
    const imgly = await this.imgly
    const result = await imgly.removeBackground(new Blob([image as BlobPart], { type: mimeType }), {
      publicPath: this.publicPath(),
      model: 'medium',
      output: { format: 'image/png' },
    })
    return { bytes: new Uint8Array(await result.arrayBuffer()), mimeType: 'image/png' }
  }
}
