import { describe, expect, it } from 'vitest'
import { ImglyImageProcessor } from '../../server/infrastructure/ImglyImageProcessor'

describe('ImglyImageProcessor', () => {
  it('leaves SVGs alone (vector art has no photo background) without loading the model', async () => {
    let loaded = false
    const processor = new ImglyImageProcessor(async () => {
      loaded = true
      throw new Error('should not load')
    })
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')
    expect(await processor.removeBackground(svg, 'image/svg+xml')).toEqual({ bytes: svg, mimeType: 'image/svg+xml' })
    expect(loaded).toBe(false)
  })

  it('passes raster photos to the model and returns a PNG', async () => {
    const processor = new ImglyImageProcessor(async () => ({
      removeBackground: async (blob: Blob) => new Blob([new Uint8Array([1, 2, (await blob.arrayBuffer()).byteLength])], { type: 'image/png' }),
    }))
    const out = await processor.removeBackground(new Uint8Array([9, 9, 9]), 'image/jpeg')
    expect(out).toEqual({ bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/png' })
  })
})
