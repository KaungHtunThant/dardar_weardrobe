import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ImglyImageProcessor } from '../../server/infrastructure/ImglyImageProcessor'

// Runs the real ONNX model (slow, ~seconds). Opt in with RUN_SLOW=1.
describe.runIf(process.env.RUN_SLOW === '1')('ImglyImageProcessor (real model)', () => {
  it('turns a photo into a PNG whose background is transparent', async () => {
    const photo = new Uint8Array(readFileSync('tests/fixtures/photos/blouse-on-blue.png'))
    const result = await new ImglyImageProcessor().removeBackground(photo, 'image/png')
    expect(result.mimeType).toBe('image/png')
    const { default: sharp } = await import('sharp')
    const { data, info } = await sharp(Buffer.from(result.bytes)).raw().ensureAlpha().toBuffer({ resolveWithObject: true })
    const alphaAt = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3]!
    expect(alphaAt(5, 5)).toBeLessThan(20) // corner: background removed
    expect(alphaAt(Math.floor(info.width / 2), Math.floor(info.height / 2))).toBeGreaterThan(200) // garment kept
  }, 120_000)
})
