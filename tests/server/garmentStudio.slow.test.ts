import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import type { StudioHints } from '#shared/contracts/ImageProcessor'
import { GarmentStudioProcessor } from '../../server/infrastructure/GarmentStudioProcessor'
import { ImglyImageProcessor } from '../../server/infrastructure/ImglyImageProcessor'
import { SegformerClothesSegmenter, segformerModelPath } from '../../server/infrastructure/SegformerClothesSegmenter'

// Runs the real background-removal and clothes-segmentation models (slow). Opt in with RUN_SLOW=1.
// The results are written to test-results/studio/ to look at.
const studio = (segment = true) =>
  new GarmentStudioProcessor({ matte: new ImglyImageProcessor(), segmenter: segment ? new SegformerClothesSegmenter() : undefined })

async function run(fixture: string, hints: StudioHints, segment = true) {
  const bytes = new Uint8Array(readFileSync(`tests/fixtures/photos/${fixture}`))
  const out = await studio(segment).removeBackground(bytes, fixture.endsWith('.png') ? 'image/png' : 'image/jpeg', hints)
  mkdirSync('test-results/studio', { recursive: true })
  writeFileSync(`test-results/studio/${fixture.replace(/\.\w+$/, '')}${segment ? '' : '-matte-only'}.png`, out.bytes)
  const { data, info } = await sharp(Buffer.from(out.bytes)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let visible = 0
  let skin = 0
  for (let i = 0; i < info.width * info.height; i++) {
    const [r, g, b, a] = [data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!, data[i * 4 + 3]!]
    if (a < 128) continue
    visible++
    // warm, light, low-saturation pixels: skin (and, here, the tee's gold print)
    if (r > 170 && g > 120 && b > 90 && r > g && g > b && r - b < 110 && r - g < 60) skin++
  }
  return { info, visible, skin, alphaAt: (x: number, y: number) => data[(y * info.width + x) * 4 + 3]! }
}

describe.runIf(process.env.RUN_SLOW === '1')('GarmentStudioProcessor (real models)', () => {
  it('has the clothes segmentation model available', () => {
    expect(segformerModelPath()).not.toBeNull()
  })

  it('cuts a worn tee out of the person, centred on the 5:6 canvas', async () => {
    // The box the stylist gave for this photo in a live run.
    const hints: StudioHints = { focus: { x: 0.05, y: 0.39, w: 0.91, h: 0.61 }, worn: true, category: 'tops' }
    const r = await run('red-tshirt-worn.jpg', hints)
    expect([r.info.width, r.info.height]).toEqual([800, 960])
    expect(r.alphaAt(4, 4)).toBe(0)
    expect(r.visible / (800 * 960)).toBeGreaterThan(0.2)
    // Without the clothes model her arms and hair stay; with it, most of that skin is gone.
    const matteOnly = await run('red-tshirt-worn.jpg', hints, false)
    console.log(`skin-like pixels: ${r.skin} with clothes segmentation, ${matteOnly.skin} matte only`)
    expect(r.skin).toBeLessThan(matteOnly.skin * 0.5)
  }, 180_000)

  it('cuts out a flat garment without any hints', async () => {
    const r = await run('blouse-on-blue.png', {})
    expect([r.info.width, r.info.height]).toEqual([800, 960])
    expect(r.alphaAt(4, 4)).toBe(0)
    expect(r.alphaAt(400, 480)).toBeGreaterThan(200)
  }, 180_000)
})
