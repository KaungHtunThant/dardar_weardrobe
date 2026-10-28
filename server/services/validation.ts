import type { z } from 'zod'
import { ValidationError } from '#shared/errors'

/** Parses input with a zod schema, turning failures into a ValidationError with the first message. */
export function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input)
  if (!result.success) {
    const issue = result.error.issues[0]!
    const field = issue.path.length ? `${issue.path.join('.')}: ` : ''
    throw new ValidationError(`${field}${issue.message}`)
  }
  return result.data
}
