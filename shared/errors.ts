/** Domain errors; the HTTP layer maps them to status codes. */
export class ValidationError extends Error {
  override name = 'ValidationError'
}

export class NotFoundError extends Error {
  override name = 'NotFoundError'
}
