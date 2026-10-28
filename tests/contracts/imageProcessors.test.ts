import sharp from 'sharp'
import type { ImageProcessor } from '#shared/contracts/ImageProcessor'
import { GarmentStudioProcessor } from '../../server/infrastructure/GarmentStudioProcessor'
import { PassThroughImageProcessor } from '../../server/infrastructure/PassThroughImageProcessor'
import { imageProcessorContract } from './imageProcessor.contract'

/** Keeps the middle of the photo, as a stand-in for the real background remover. */
const centreMatte: ImageProcessor = {
  async removeBackground(bytes) {
    const { data, info } = await sharp(Buffer.from(bytes)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    for (let y = 0; y < info.height; y++)
      for (let x = 0; x < info.width; x++) {
        const inside = x > info.width / 4 && x < (3 * info.width) / 4 && y > info.height / 4 && y < (3 * info.height) / 4
        if (!inside) data[(y * info.width + x) * 4 + 3] = 0
      }
    return { bytes: new Uint8Array(await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()), mimeType: 'image/png' }
  },
}

imageProcessorContract('PassThroughImageProcessor', () => new PassThroughImageProcessor())
imageProcessorContract('GarmentStudioProcessor (fake matte)', () => new GarmentStudioProcessor({ matte: centreMatte }))
