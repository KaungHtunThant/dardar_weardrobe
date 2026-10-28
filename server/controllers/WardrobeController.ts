import { readBody, type H3Event } from 'h3'
import { z } from 'zod'
import { parseOrThrow } from '../services/validation'

const ConfirmSchema = z.object({ confirm: z.literal(true, { error: 'Please confirm that you want to delete everything.' }) })

export class WardrobeController {
  constructor(private readonly clearWardrobe: () => Promise<void>) {}

  /** Destructive: requires `{ confirm: true }` so it can't happen by accident. */
  async clear(event: H3Event) {
    parseOrThrow(ConfirmSchema, await readBody(event))
    await this.clearWardrobe()
    return { cleared: true }
  }
}
