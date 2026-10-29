/** Domain errors; the HTTP layer maps them to status codes. */
export class ValidationError extends Error {
  override name = 'ValidationError'
}

export class NotFoundError extends Error {
  override name = 'NotFoundError'
}

/** An outside service the feature needs (e.g. the city search) can't be reached right now. */
export class UnavailableError extends Error {
  override name = 'UnavailableError'
}
