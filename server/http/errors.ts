import { createError, isError } from 'h3'
import { NotFoundError, ValidationError } from '#shared/errors'

/** Maps domain errors to HTTP errors; anything unexpected becomes a 500 without leaking details. */
export function toHttpError(e: unknown) {
  if (isError(e)) return e
  if (e instanceof ValidationError) return createError({ statusCode: 400, statusMessage: 'Bad Request', message: e.message, data: { message: e.message } })
  if (e instanceof NotFoundError) return createError({ statusCode: 404, statusMessage: 'Not Found', message: e.message, data: { message: e.message } })
  console.error('[dardar] unexpected error', e)
  return createError({ statusCode: 500, statusMessage: 'Server Error', message: 'Something went wrong.', data: { message: 'Something went wrong.' } })
}
