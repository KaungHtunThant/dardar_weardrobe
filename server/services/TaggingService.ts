import { z } from 'zod'
import type { DetailsSuggestion, GarmentTagger } from '#shared/contracts/GarmentTagger'
import { ValidationError } from '#shared/errors'
import type { FsImageStore } from '../infrastructure/FsImageStore'
import { parseOrThrow } from './validation'

const SuggestSchema = z.object({ image: z.string().min(1) })

/** Add-item pre-fill: asks the current tagger about an uploaded (clean) image. */
export class TaggingService {
  constructor(
    private readonly images: FsImageStore,
    private readonly tagger: () => Promise<GarmentTagger>,
  ) {}

  async suggest(input: unknown): Promise<DetailsSuggestion> {
    const { image } = parseOrThrow(SuggestSchema, input)
    const stored = await this.images.read(image)
    if (!stored) throw new ValidationError('Upload a photo first.')
    return (await this.tagger()).suggestDetails({ ...stored, path: this.images.pathOf(image) })
  }
}
