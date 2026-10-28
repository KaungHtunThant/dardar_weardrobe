import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import type { ClothesSegmenter, Mask, RawImage } from '#shared/contracts/ClothesSegmenter'
import { CLOTHES_LABELS, type ClothesLabel } from '#shared/utils/clothesLabels'

const SIZE = 512
const MEAN = [0.485, 0.456, 0.406]
const STD = [0.229, 0.224, 0.225]
const MODEL = join('segformer-clothes', 'model_quantized.onnx')

interface OrtTensor {
  data: Float32Array | ArrayLike<number>
  dims: readonly number[]
}
interface OrtSession {
  inputNames: readonly string[]
  outputNames: readonly string[]
  run(feeds: Record<string, OrtTensor>): Promise<Record<string, OrtTensor>>
}
/** The slice of onnxruntime-node used here, so tests can pass a fake. */
export interface OrtLike {
  Tensor: new (type: 'float32', data: Float32Array, dims: readonly number[]) => OrtTensor
  InferenceSession: { create(path: string): Promise<OrtSession> }
}

/**
 * Where scripts/fetch-models.mjs put the model: `vendor/models` in the project, or `models` next to
 * the built server (scripts/bundle-server-assets.mjs). Searched upwards from this file, then the working directory.
 */
export function segformerModelPath(): string | null {
  const starts = [dirname(fileURLToPath(import.meta.url)), process.cwd()]
  for (const start of starts) {
    let dir = start
    for (;;) {
      for (const base of ['models', join('vendor', 'models')]) {
        const file = join(dir, base, MODEL)
        if (existsSync(file)) return file
      }
      const up = dirname(dir)
      if (up === dir) break
      dir = up
    }
  }
  return null
}

/** Loaded on first use: most requests never need the ONNX runtime. */
const loadOrt = async () => (await import('onnxruntime-node')) as unknown as OrtLike

/**
 * SegFormer B2 fine-tuned on human parsing (ATR): for every pixel, how likely it is the hat,
 * top, skirt, shoe… versus hair, face, arms or legs. Runs locally on the CPU (~1 s).
 * Weights: NVIDIA SegFormer licence, non-commercial use only.
 */
export class SegformerClothesSegmenter implements ClothesSegmenter {
  private session: Promise<{ ort: OrtLike; session: OrtSession }> | null = null

  constructor(
    private readonly modelPath: () => string | null = segformerModelPath,
    private readonly load: () => Promise<OrtLike> = loadOrt,
  ) {}

  private open() {
    this.session ??= (async () => {
      const path = this.modelPath()
      if (!path) throw new Error('The clothes segmentation model is missing (run `npm run models`).')
      const ort = await this.load()
      return { ort, session: await ort.InferenceSession.create(path) }
    })().catch((e) => {
      this.session = null
      throw e
    })
    return this.session
  }

  async garmentMask(image: RawImage, labels: readonly ClothesLabel[]): Promise<Mask> {
    const { ort, session } = await this.open()
    const pixels = await sharp(Buffer.from(image.data), { raw: { width: image.width, height: image.height, channels: 3 } })
      .resize(SIZE, SIZE, { fit: 'fill' })
      .raw()
      .toBuffer()
    const input = new Float32Array(3 * SIZE * SIZE)
    for (let i = 0; i < SIZE * SIZE; i++)
      for (let c = 0; c < 3; c++) input[c * SIZE * SIZE + i] = (pixels[i * 3 + c]! / 255 - MEAN[c]!) / STD[c]!
    const out = await session.run({ [session.inputNames[0]!]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) })
    const logits = out[session.outputNames[0]!]!
    const [, classes, height, width] = logits.dims as [number, number, number, number]
    const wanted = labels.map((l) => CLOTHES_LABELS.indexOf(l)).filter((c) => c >= 0 && c < classes)
    const plane = height * width
    const data = new Uint8Array(plane)
    for (let i = 0; i < plane; i++) {
      // softmax over the classes at this pixel, summed over the wanted ones
      let max = -Infinity
      for (let c = 0; c < classes; c++) max = Math.max(max, logits.data[c * plane + i]!)
      let total = 0
      let keep = 0
      for (let c = 0; c < classes; c++) {
        const e = Math.exp(logits.data[c * plane + i]! - max)
        total += e
        if (wanted.includes(c)) keep += e
      }
      data[i] = Math.round((255 * keep) / total)
    }
    return { data, width, height }
  }
}
