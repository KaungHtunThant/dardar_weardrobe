import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { GarmentAnalysis, GarmentAnalyst } from '#shared/contracts/GarmentAnalyst'
import type { GarmentImage } from '#shared/contracts/GarmentTagger'
import type { ImageProcessor, StudioHints } from '#shared/contracts/ImageProcessor'
import { ValidationError } from '#shared/errors'
import { FsImageStore } from '../../server/infrastructure/FsImageStore'
import { GarmentPipeline, type PipelineStage } from '../../server/services/GarmentPipeline'

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
const CLEAN = new Uint8Array([137, 80, 78, 71, 1, 2, 3])
const analysis: GarmentAnalysis = {
  focus: { x: 0.1, y: 0.3, w: 0.8, h: 0.6 },
  worn: true,
  details: { name: 'Red Tee', category: 'tops', colors: ['red'] },
}

let dir: string
let images: FsImageStore
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dardar-pipeline-'))
  images = new FsImageStore(dir)
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

function recorder() {
  const seen: { analysed?: GarmentImage; hints?: StudioHints; stages: PipelineStage[] } = { stages: [] }
  const analyst: GarmentAnalyst = {
    async analyze(image) {
      seen.analysed = image
      return analysis
    },
  }
  const processor: ImageProcessor = {
    async removeBackground(_bytes, _mime, hints) {
      seen.hints = hints
      return { bytes: CLEAN, mimeType: 'image/png' }
    },
  }
  return { seen, analyst, processor }
}

describe('GarmentPipeline', () => {
  it('asks the stylist about the original, then cuts out what it found', async () => {
    const { seen, analyst, processor } = recorder()
    const original = await images.save(PNG, 'image/png')
    const pipeline = new GarmentPipeline({ images, processor, analyst: async () => analyst })
    const out = await pipeline.prepare(original, { onStage: (s) => seen.stages.push(s) })
    expect(seen.stages).toEqual(['analyzing', 'isolating'])
    expect(seen.analysed!.path).toBe(images.pathOf(original))
    expect(seen.hints).toEqual({ focus: analysis.focus, worn: true, category: 'tops' })
    expect(out.backgroundRemoved).toBe(true)
    expect(out.suggestion).toEqual(analysis.details)
    expect((await images.read(out.cleanImage))!.bytes).toEqual(CLEAN)
  })

  it('shows the stylist a smaller copy and tidies it away afterwards', async () => {
    const { seen, analyst, processor } = recorder()
    const original = await images.save(PNG, 'image/png')
    const preview = async () => ({ bytes: new Uint8Array([255, 216, 255]), mimeType: 'image/jpeg' })
    await new GarmentPipeline({ images, processor, analyst: async () => analyst, preview }).prepare(original)
    expect(seen.analysed!.mimeType).toBe('image/jpeg')
    expect(seen.analysed!.path).toMatch(/\.jpg$/)
    expect(readdirSync(dir).filter((f) => f.endsWith('.jpg'))).toEqual([])
  })

  it('still cuts the photo out when the stylist is unavailable', async () => {
    const { seen, processor } = recorder()
    const original = await images.save(PNG, 'image/png')
    const broken: GarmentAnalyst = { analyze: async () => Promise.reject(new Error('Not logged in')) }
    const out = await new GarmentPipeline({ images, processor, analyst: async () => broken, log: () => {} }).prepare(original)
    expect(seen.hints).toEqual({ focus: null, worn: false, category: undefined })
    expect(out).toMatchObject({ backgroundRemoved: true, suggestion: {} })
  })

  it("uses the closet's category when the stylist can't tell", async () => {
    const { seen, processor } = recorder()
    const original = await images.save(PNG, 'image/png')
    const unsure: GarmentAnalyst = { analyze: async () => ({ focus: null, worn: false, details: {} }) }
    await new GarmentPipeline({ images, processor, analyst: async () => unsure }).prepare(original, { categoryHint: 'shoes' })
    expect(seen.hints!.category).toBe('shoes')
  })

  it('keeps the original when cutting out fails', async () => {
    const { analyst } = recorder()
    const original = await images.save(PNG, 'image/png')
    const failing: ImageProcessor = { removeBackground: async () => Promise.reject(new Error('onnx')) }
    const out = await new GarmentPipeline({ images, processor: failing, analyst: async () => analyst, log: () => {} }).prepare(original)
    expect(out).toMatchObject({ cleanImage: original, backgroundRemoved: false, suggestion: analysis.details })
  })

  it('stops when cancelled and leaves no new image behind', async () => {
    const { processor } = recorder()
    const original = await images.save(PNG, 'image/png')
    const controller = new AbortController()
    const analyst: GarmentAnalyst = {
      async analyze() {
        controller.abort()
        return analysis
      },
    }
    const run = new GarmentPipeline({ images, processor, analyst: async () => analyst }).prepare(original, { signal: controller.signal })
    await expect(run).rejects.toMatchObject({ name: 'AbortError' })
    expect(readdirSync(dir)).toHaveLength(1)
  })

  it('needs a stored original', async () => {
    const { analyst, processor } = recorder()
    await expect(new GarmentPipeline({ images, processor, analyst: async () => analyst }).prepare('/api/images/nope.png')).rejects.toBeInstanceOf(
      ValidationError,
    )
  })
})
