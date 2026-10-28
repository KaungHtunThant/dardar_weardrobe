import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CLOTHES_LABELS } from '#shared/utils/clothesLabels'
import { SegformerClothesSegmenter, segformerModelPath, type OrtLike } from '../../server/infrastructure/SegformerClothesSegmenter'

/** A fake ONNX runtime whose model answers with fixed logits on a 2×2 grid. */
function fakeOrt(logits: (label: number, pixel: number) => number, seen: { dims?: readonly number[]; path?: string; creates: number }): OrtLike {
  const C = CLOTHES_LABELS.length
  return {
    Tensor: class {
      constructor(
        readonly type: string,
        readonly data: Float32Array,
        readonly dims: readonly number[],
      ) {}
    } as never,
    InferenceSession: {
      async create(path: string) {
        seen.creates++
        seen.path = path
        return {
          inputNames: ['pixel_values'],
          outputNames: ['logits'],
          async run(feeds: Record<string, { dims: readonly number[] }>) {
            seen.dims = feeds.pixel_values!.dims
            const data = new Float32Array(C * 4)
            for (let c = 0; c < C; c++) for (let p = 0; p < 4; p++) data[c * 4 + p] = logits(c, p)
            return { logits: { data, dims: [1, C, 2, 2] } }
          },
        }
      },
    },
  }
}

const image = { data: new Uint8Array(6 * 4 * 3).fill(128), width: 6, height: 4 }
const UPPER = CLOTHES_LABELS.indexOf('Upper-clothes')
const FACE = CLOTHES_LABELS.indexOf('Face')

describe('SegformerClothesSegmenter', () => {
  it('feeds the model a normalised 512×512 image and returns the probability of the wanted labels', async () => {
    const seen = { creates: 0 } as { dims?: readonly number[]; path?: string; creates: number }
    // pixel 0: clearly a top; pixel 1: clearly a face; pixels 2–3: undecided between the two
    const logits = (c: number, p: number) => (p === 0 ? (c === UPPER ? 10 : 0) : p === 1 ? (c === FACE ? 10 : 0) : c === UPPER || c === FACE ? 5 : 0)
    const segmenter = new SegformerClothesSegmenter(() => '/models/seg.onnx', async () => fakeOrt(logits, seen))
    const mask = await segmenter.garmentMask(image, ['Upper-clothes', 'Dress'])
    expect(seen.dims).toEqual([1, 3, 512, 512])
    expect(seen.path).toBe('/models/seg.onnx')
    expect([mask.width, mask.height]).toEqual([2, 2])
    expect(mask.data[0]).toBeGreaterThan(250)
    expect(mask.data[1]).toBeLessThan(5)
    expect(mask.data[2]).toBeGreaterThan(110)
    expect(mask.data[2]).toBeLessThan(140)
  })

  it('loads the model once', async () => {
    const seen = { creates: 0 }
    const segmenter = new SegformerClothesSegmenter(() => '/m.onnx', async () => fakeOrt(() => 0, seen))
    await segmenter.garmentMask(image, ['Bag'])
    await segmenter.garmentMask(image, ['Bag'])
    expect(seen.creates).toBe(1)
  })

  it('says so when the model file is missing', async () => {
    const segmenter = new SegformerClothesSegmenter(() => null, async () => fakeOrt(() => 0, { creates: 0 }))
    await expect(segmenter.garmentMask(image, ['Bag'])).rejects.toThrow(/model/i)
  })

  it('finds the downloaded model from the project folder', () => {
    const path = segformerModelPath()
    // Present after `npm install` (scripts/fetch-models.mjs); absent offline.
    if (path) expect(existsSync(path)).toBe(true)
    expect(path === null || path.endsWith('segformer-clothes/model_quantized.onnx')).toBe(true)
  })
})
