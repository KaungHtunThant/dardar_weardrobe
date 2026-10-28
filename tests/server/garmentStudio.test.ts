import sharp from 'sharp'
import { beforeAll, describe, expect, it } from 'vitest'
import type { ClothesSegmenter, RawImage } from '#shared/contracts/ClothesSegmenter'
import type { ImageProcessor } from '#shared/contracts/ImageProcessor'
import type { ClothesLabel } from '#shared/utils/clothesLabels'
import { GarmentStudioProcessor } from '../../server/infrastructure/GarmentStudioProcessor'

/**
 * A 400×600 photo: blue backdrop, a skin-coloured head (x 150–250, y 60–200) above a red top
 * (x 100–300, y 220–560). The fake matte keeps everything that isn't blue (the whole "person");
 * the fake segmenter calls only red pixels clothes.
 */
const W = 400
const H = 600
const SKIN = { r: 230, g: 190, b: 160 }
const RED = { r: 200, g: 30, b: 40 }
let photo: Uint8Array

beforeAll(async () => {
  const rect = (w: number, h: number, c: typeof RED) => sharp({ create: { width: w, height: h, channels: 3, background: c } }).png().toBuffer()
  photo = new Uint8Array(
    await sharp({ create: { width: W, height: H, channels: 3, background: { r: 40, g: 80, b: 220 } } })
      .composite([
        { input: await rect(100, 140, SKIN), left: 150, top: 60 },
        { input: await rect(200, 340, RED), left: 100, top: 220 },
      ])
      .jpeg({ quality: 95 })
      .toBuffer(),
  )
})

const isBlue = (r: number, g: number, b: number) => b > 150 && r < 120
const isRed = (r: number, g: number, b: number) => r > 150 && g < 90 && b < 100

const fakeMatte: ImageProcessor = {
  async removeBackground(bytes) {
    const { data, info } = await sharp(Buffer.from(bytes)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const rgba = Buffer.alloc(info.width * info.height * 4)
    for (let i = 0; i < info.width * info.height; i++) {
      rgba.set([data[i * 3]!, data[i * 3 + 1]!, data[i * 3 + 2]!, isBlue(data[i * 3]!, data[i * 3 + 1]!, data[i * 3 + 2]!) ? 0 : 255], i * 4)
    }
    return { bytes: new Uint8Array(await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()), mimeType: 'image/png' }
  },
}

function fakeSegmenter(seen: { labels?: readonly ClothesLabel[]; calls: number } = { calls: 0 }): ClothesSegmenter {
  return {
    async garmentMask(image: RawImage, labels) {
      seen.calls++
      seen.labels = labels
      // Low resolution, like the real model.
      const mw = 64
      const mh = 64
      const data = new Uint8Array(mw * mh)
      for (let y = 0; y < mh; y++)
        for (let x = 0; x < mw; x++) {
          const sx = Math.floor((x / mw) * image.width)
          const sy = Math.floor((y / mh) * image.height)
          const i = (sy * image.width + sx) * 3
          data[y * mw + x] = isRed(image.data[i]!, image.data[i + 1]!, image.data[i + 2]!) ? 255 : 0
        }
      return { data, width: mw, height: mh }
    },
  }
}

async function decode(bytes: Uint8Array) {
  const { data, info } = await sharp(Buffer.from(bytes)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const px = (x: number, y: number) => {
    const i = (y * info.width + x) * 4
    return { r: data[i]!, g: data[i + 1]!, b: data[i + 2]!, a: data[i + 3]! }
  }
  let skin = 0
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      const p = px(x, y)
      if (p.a < 128) continue
      // Skin is light in every channel; the red top has almost no green (tone changes keep that apart).
      if (p.g > 110 && p.b > 90) skin++
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    }
  return { info, px, skin, box: { minX, minY, maxX, maxY } }
}

const topFocus = { x: 0.2, y: 0.05, w: 0.6, h: 0.9 } // the stylist's box, sloppy enough to include the head

describe('GarmentStudioProcessor', () => {
  it('cuts a worn garment out of the person and centres it on the 5:6 studio canvas', async () => {
    const seen = { calls: 0 } as { labels?: readonly ClothesLabel[]; calls: number }
    const studio = new GarmentStudioProcessor({ matte: fakeMatte, segmenter: fakeSegmenter(seen) })
    const out = await studio.removeBackground(photo, 'image/jpeg', { focus: topFocus, worn: true, category: 'tops' })
    expect(out.mimeType).toBe('image/png')
    const img = await decode(out.bytes)
    expect([img.info.width, img.info.height]).toEqual([800, 960])
    expect(img.px(2, 2).a).toBe(0)
    expect(img.skin).toBe(0) // the head is gone
    expect(seen.labels).toEqual(expect.arrayContaining(['Upper-clothes']))
    // Fills the padded area (640×768) on its tighter side and sits in the middle.
    const w = img.box.maxX - img.box.minX + 1
    const h = img.box.maxY - img.box.minY + 1
    expect(Math.max(w / 640, h / 768)).toBeGreaterThan(0.95)
    expect(Math.abs((img.box.minX + img.box.maxX) / 2 - 400)).toBeLessThan(10)
    expect(Math.abs((img.box.minY + img.box.maxY) / 2 - 480)).toBeLessThan(10)
  })

  it('uses only the background matte when nobody is wearing the garment', async () => {
    const seen = { calls: 0 }
    const out = await new GarmentStudioProcessor({ matte: fakeMatte, segmenter: fakeSegmenter(seen) }).removeBackground(photo, 'image/jpeg', {
      worn: false,
      category: 'tops',
    })
    expect(seen.calls).toBe(0)
    expect((await decode(out.bytes)).skin).toBeGreaterThan(0)
  })

  it('falls back to the matte when the segmenter fails or finds next to nothing', async () => {
    const failing: ClothesSegmenter = { garmentMask: async () => Promise.reject(new Error('model missing')) }
    const empty: ClothesSegmenter = { garmentMask: async () => ({ data: new Uint8Array(16), width: 4, height: 4 }) }
    for (const segmenter of [failing, empty]) {
      const out = await new GarmentStudioProcessor({ matte: fakeMatte, segmenter, log: () => {} }).removeBackground(photo, 'image/jpeg', {
        focus: topFocus,
        worn: true,
        category: 'tops',
      })
      const img = await decode(out.bytes)
      expect([img.info.width, img.info.height]).toEqual([800, 960])
      expect(img.skin).toBeGreaterThan(0)
    }
  })

  it('sits shoes low in the frame', async () => {
    const out = await new GarmentStudioProcessor({ matte: fakeMatte }).removeBackground(photo, 'image/jpeg', { category: 'shoes' })
    const img = await decode(out.bytes)
    expect(img.box.maxY).toBeGreaterThan(830)
    expect(img.box.maxY).toBeLessThan(850)
  })

  it('works without any hints', async () => {
    const out = await new GarmentStudioProcessor({ matte: fakeMatte }).removeBackground(photo, 'image/jpeg')
    expect((await decode(out.bytes)).info.width).toBe(800)
  })

  it('reports a failed matte so the caller can keep the original', async () => {
    const broken: ImageProcessor = { removeBackground: async () => Promise.reject(new Error('onnx')) }
    await expect(new GarmentStudioProcessor({ matte: broken }).removeBackground(photo, 'image/jpeg')).rejects.toThrow('onnx')
  })

  it('reports an empty cut-out instead of returning a blank canvas', async () => {
    const blank: ImageProcessor = {
      async removeBackground() {
        return { bytes: new Uint8Array(await sharp({ create: { width: 10, height: 10, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer()), mimeType: 'image/png' }
      },
    }
    await expect(new GarmentStudioProcessor({ matte: blank }).removeBackground(photo, 'image/jpeg')).rejects.toThrow(/nothing/i)
  })
})
