import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import type { ImageProcessor, ProcessedImage } from '#shared/contracts/ImageProcessor'
import { imglyDist, imglyPublicPath } from './ImglyImageProcessor'

/** The imgly package's ES module entry, which the worker imports by path (the built server ships only this one). */
export function imglyEntry(): string {
  return join(imglyDist(), 'index.mjs')
}

/**
 * Runs inside the worker: loads imgly once (the model stays warm) and answers one message per photo.
 * Plain CommonJS so it needs no build step; imgly is imported by absolute path.
 */
const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads')
let imgly
parentPort.on('message', async ({ id, bytes, mimeType }) => {
  try {
    imgly ??= import(workerData.entryUrl)
    const m = await imgly
    const blob = await m.removeBackground(new Blob([bytes], { type: mimeType }), {
      publicPath: workerData.publicPath,
      model: 'medium',
      output: { format: 'image/png' },
    })
    const out = new Uint8Array(await blob.arrayBuffer())
    parentPort.postMessage({ id, bytes: out }, [out.buffer])
  } catch (e) {
    parentPort.postMessage({ id, error: String((e && e.message) || e) })
  }
})
`

interface Pending {
  resolve(image: ProcessedImage): void
  reject(error: Error): void
}

/**
 * Background removal with imgly (like ImglyImageProcessor), but in a worker thread: the model's
 * work blocks for seconds per photo, and the API must keep answering while uploads are prepared.
 */
export class WorkerImglyImageProcessor implements ImageProcessor {
  private worker: Worker | null = null
  private readonly pending = new Map<number, Pending>()
  private nextId = 0

  constructor(
    private readonly o: { entry?: () => string; publicPath?: () => string } = {},
  ) {}

  private start(): Worker {
    if (this.worker) return this.worker
    const entry = (this.o.entry ?? imglyEntry)()
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: { entryUrl: pathToFileURL(entry).href, publicPath: (this.o.publicPath ?? imglyPublicPath)() },
    })
    worker.unref()
    worker.on('message', ({ id, bytes, error }: { id: number; bytes?: Uint8Array; error?: string }) => {
      const p = this.pending.get(id)
      this.pending.delete(id)
      if (error !== undefined) p?.reject(new Error(error))
      else p?.resolve({ bytes: new Uint8Array(bytes!), mimeType: 'image/png' })
    })
    const fail = (error: Error) => {
      if (this.worker === worker) this.worker = null
      for (const p of this.pending.values()) p.reject(error)
      this.pending.clear()
    }
    worker.on('error', fail)
    worker.on('exit', (code) => fail(new Error(`The background-removal worker stopped (exit code ${code}).`)))
    return (this.worker = worker)
  }

  async removeBackground(image: Uint8Array, mimeType: string): Promise<ProcessedImage> {
    // Vector art has no photographic background to remove.
    if (mimeType === 'image/svg+xml') return { bytes: image, mimeType }
    const worker = this.start()
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      const bytes = image.slice()
      worker.postMessage({ id, bytes, mimeType }, [bytes.buffer])
    })
  }

  /** Stops the worker (the next photo starts a new one). */
  async close() {
    const worker = this.worker
    this.worker = null
    await worker?.terminate()
  }
}
