import { describe, expect, it } from 'vitest'
import type { GarmentAnalyst } from '#shared/contracts/GarmentAnalyst'
import type { GarmentImage } from '#shared/contracts/GarmentTagger'
import { CATEGORY_IDS } from '#shared/models/category'

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
export const photo: GarmentImage = { bytes: PNG, mimeType: 'image/png', path: '/data/images/original.png' }

/** Behaviour every GarmentAnalyst shares: Claude through the CLI or the API, or nothing offline. */
export function garmentAnalystContract(name: string, make: () => GarmentAnalyst) {
  describe(`GarmentAnalyst contract: ${name}`, () => {
    it('returns a focus box inside the photo (or none) and only valid details', async () => {
      const a = await make().analyze(photo)
      if (a.focus) {
        for (const v of [a.focus.x, a.focus.y, a.focus.w, a.focus.h]) expect(v).toBeGreaterThanOrEqual(0)
        expect(a.focus.x + a.focus.w).toBeLessThanOrEqual(1)
        expect(a.focus.y + a.focus.h).toBeLessThanOrEqual(1)
      }
      expect(typeof a.worn).toBe('boolean')
      if (a.details.category) expect(CATEGORY_IDS).toContain(a.details.category)
    })

    it('stops when cancelled', async () => {
      await expect(make().analyze(photo, { signal: AbortSignal.abort() })).rejects.toMatchObject({ name: 'AbortError' })
    })

    it('says nothing about images it cannot look at (SVG)', async () => {
      expect(await make().analyze({ ...photo, mimeType: 'image/svg+xml' })).toEqual({ focus: null, worn: false, details: {} })
    })
  })
}
