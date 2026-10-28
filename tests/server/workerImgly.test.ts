import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { imglyEntry, WorkerImglyImageProcessor } from '../../server/infrastructure/WorkerImglyImageProcessor'

const fakeEntry = fileURLToPath(new URL('../fixtures/workers/fake-imgly.mjs', import.meta.url))
let processor: WorkerImglyImageProcessor | undefined
afterEach(async () => processor?.close())

const make = () => (processor = new WorkerImglyImageProcessor({ entry: () => fakeEntry, publicPath: () => 'file:///models/' }))

describe('WorkerImglyImageProcessor', () => {
  it('removes the background in a worker thread and returns a PNG', async () => {
    expect(await make().removeBackground(new Uint8Array([1, 2, 3]), 'image/jpeg')).toEqual({ bytes: new Uint8Array([3, 2, 1]), mimeType: 'image/png' })
  })

  it('keeps answers apart when several photos are in flight', async () => {
    const p = make()
    const [a, b] = await Promise.all([p.removeBackground(new Uint8Array([1, 2]), 'image/png'), p.removeBackground(new Uint8Array([7, 8, 9]), 'image/png')])
    expect([...a.bytes]).toEqual([2, 1])
    expect([...b.bytes]).toEqual([9, 8, 7])
  })

  it('reports the model failing', async () => {
    await expect(make().removeBackground(new Uint8Array([0]), 'image/png')).rejects.toThrow('model exploded')
  })

  it('leaves the main thread free while the model works', async () => {
    const p = make()
    await p.removeBackground(new Uint8Array([5]), 'image/png') // worker started
    let ticks = 0
    const timer = setInterval(() => ticks++, 10)
    await p.removeBackground(new Uint8Array([1]), 'image/png') // busy for 400 ms in the worker
    clearInterval(timer)
    expect(ticks).toBeGreaterThan(20)
  })

  it('leaves SVGs alone without starting a worker', async () => {
    const svg = new TextEncoder().encode('<svg/>')
    expect(await make().removeBackground(svg, 'image/svg+xml')).toEqual({ bytes: svg, mimeType: 'image/svg+xml' })
  })

  it("imports the imgly package's ES module entry (the only one the built server ships)", () => {
    expect(imglyEntry()).toMatch(/@imgly\/background-removal-node\/dist\/index\.mjs$/)
  })

  it('starts a new worker after the old one died', async () => {
    const p = make()
    await p.removeBackground(new Uint8Array([1, 2]), 'image/png')
    await p.close()
    expect([...(await p.removeBackground(new Uint8Array([4, 5]), 'image/png')).bytes]).toEqual([5, 4])
  })
})
