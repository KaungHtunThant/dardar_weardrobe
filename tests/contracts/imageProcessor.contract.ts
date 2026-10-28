import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { ImageProcessor } from '#shared/contracts/ImageProcessor'

const photo = () => new Uint8Array(readFileSync('tests/fixtures/photos/blouse-on-blue.png'))

/** Behaviour every ImageProcessor shares (pass-through in tests, the garment studio in the app). */
export function imageProcessorContract(name: string, make: () => ImageProcessor) {
  describe(`ImageProcessor contract: ${name}`, () => {
    it('returns an image for a photo, with or without the stylist’s hints', async () => {
      for (const hints of [undefined, { focus: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }, worn: false, category: 'tops' as const }]) {
        const out = await make().removeBackground(photo(), 'image/png', hints)
        expect(out.mimeType).toMatch(/^image\//)
        expect(out.bytes.byteLength).toBeGreaterThan(0)
      }
    })

    it('leaves vector art alone', async () => {
      const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')
      expect(await make().removeBackground(svg, 'image/svg+xml')).toEqual({ bytes: svg, mimeType: 'image/svg+xml' })
    })
  })
}
