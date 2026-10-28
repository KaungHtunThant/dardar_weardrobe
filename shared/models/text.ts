import { z } from 'zod'

/** Optional free text: blank input is stored as "not provided". */
export const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(max).optional(),
  )
