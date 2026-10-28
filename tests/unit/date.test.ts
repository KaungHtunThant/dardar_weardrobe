import { describe, expect, it } from 'vitest'
import { localIsoDate } from '#shared/utils/date'

describe('localIsoDate', () => {
  it('formats the local calendar date as YYYY-MM-DD', () => {
    expect(localIsoDate(new Date(2026, 9, 28, 23, 59))).toBe('2026-10-28')
    expect(localIsoDate(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05')
  })
})
