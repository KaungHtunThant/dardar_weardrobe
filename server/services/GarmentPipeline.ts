import { NO_ANALYSIS, type GarmentAnalysis, type GarmentAnalyst } from '#shared/contracts/GarmentAnalyst'
import type { DetailsSuggestion } from '#shared/contracts/GarmentTagger'
import type { ImageProcessor } from '#shared/contracts/ImageProcessor'
import type { ImageStore, StoredImage } from '#shared/contracts/ImageStore'
import type { CategoryId } from '#shared/models/category'
import { ValidationError } from '#shared/errors'

export type PipelineStage = 'analyzing' | 'isolating'

export interface PreparedGarment {
  cleanImage: string
  /** False when cutting out failed and the clean image is the original. */
  backgroundRemoved: boolean
  /** What the stylist suggests for the details form (may be empty). */
  suggestion: DetailsSuggestion
}

/** Images on this computer, so local tools (the Claude CLI) can read them by path. */
export interface LocalImageStore extends ImageStore {
  pathOf(ref: string): string | null
}

/** A smaller copy of a photo for the stylist to look at (API size limits, faster uploads). */
export type AnalysisPreview = (bytes: Uint8Array, mimeType: string) => Promise<StoredImage>

export interface GarmentPipelineOptions {
  images: LocalImageStore
  processor: ImageProcessor
  /** The analyst for the current settings (CLI, API or offline). */
  analyst: () => Promise<GarmentAnalyst>
  preview?: AnalysisPreview
  log?: (message: string, error?: unknown) => void
}

const isAbort = (e: unknown) => (e as { name?: string })?.name === 'AbortError'

/**
 * Turns an uploaded photo into a wardrobe-ready garment: the stylist finds the garment and
 * suggests its details, then the image processor cuts exactly that out. Each step degrades
 * gracefully: without the stylist the whole photo is cut out; if cutting out fails, the original stays.
 */
export class GarmentPipeline {
  constructor(private readonly o: GarmentPipelineOptions) {}

  private log(message: string, error?: unknown) {
    ;(this.o.log ?? ((m, e) => console.warn(`[dardar] ${m}`, e ?? '')))(message, error)
  }

  /** `categoryHint` (the closet it was added from) is used when the stylist can't tell the category. */
  async prepare(
    originalImage: string,
    { signal, onStage, categoryHint }: { signal?: AbortSignal; onStage?: (stage: PipelineStage) => void; categoryHint?: CategoryId } = {},
  ): Promise<PreparedGarment> {
    const original = await this.o.images.read(originalImage)
    if (!original) throw new ValidationError('Upload a photo first.')

    onStage?.('analyzing')
    const analysis = await this.analyze(original, originalImage, signal)
    signal?.throwIfAborted()

    onStage?.('isolating')
    let cleanImage = originalImage
    let backgroundRemoved = false
    try {
      const clean = await this.o.processor.removeBackground(original.bytes, original.mimeType, {
        focus: analysis.focus,
        worn: analysis.worn,
        category: analysis.details.category ?? categoryHint,
      })
      signal?.throwIfAborted()
      cleanImage = await this.o.images.save(clean.bytes, clean.mimeType)
      backgroundRemoved = true
    } catch (e) {
      if (isAbort(e)) throw e
      this.log('cutting out the garment failed, keeping the original photo:', e)
    }
    return { cleanImage, backgroundRemoved, suggestion: analysis.details }
  }

  private async analyze(original: StoredImage, ref: string, signal?: AbortSignal): Promise<GarmentAnalysis> {
    let tempRef: string | null = null
    try {
      let image = { ...original, path: this.o.images.pathOf(ref) }
      if (this.o.preview && original.mimeType !== 'image/svg+xml') {
        const small = await this.o.preview(original.bytes, original.mimeType)
        tempRef = await this.o.images.save(small.bytes, small.mimeType)
        image = { ...small, path: this.o.images.pathOf(tempRef) }
      }
      return await (await this.o.analyst()).analyze(image, { signal })
    } catch (e) {
      if (isAbort(e)) throw e
      this.log('the stylist could not look at the photo; cutting out the whole photo:', e)
      return NO_ANALYSIS
    } finally {
      if (tempRef) await this.o.images.delete(tempRef)
    }
  }
}
