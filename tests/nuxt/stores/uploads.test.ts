import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUploadsStore, UPLOAD_POLL_MS } from '~/stores/uploads'
import { useWardrobeStore } from '~/stores/wardrobe'
import { setupTestGateway } from '../helpers'

const photo = (name = 'tee.png') => new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' })

describe('uploads store', () => {
  let gateway: ReturnType<typeof setupTestGateway>
  beforeEach(() => {
    gateway = setupTestGateway()
    vi.useFakeTimers()
  })
  afterEach(() => {
    useUploadsStore().stop()
    vi.useRealTimers()
  })

  it('queues photos and keeps checking on them only while some are being prepared', async () => {
    const store = useUploadsStore()
    const list = vi.spyOn(gateway, 'listUploads')
    await store.enqueue([photo(), photo('b.png')], 'shoes')
    expect(store.uploads.map((u) => u.state)).toEqual(['queued', 'queued'])
    expect(store.active).toHaveLength(2)

    await vi.advanceTimersByTimeAsync(UPLOAD_POLL_MS * 3)
    expect(store.uploads.map((u) => u.state)).toEqual(['ready', 'ready'])
    expect(store.ready).toHaveLength(2)
    const calls = list.mock.calls.length
    await vi.advanceTimersByTimeAsync(UPLOAD_POLL_MS * 5)
    expect(list.mock.calls.length).toBe(calls) // stopped polling
  })

  it('picks up photos still being prepared when the app opens', async () => {
    await gateway.enqueuePhotos([photo()])
    const store = useUploadsStore()
    await store.load()
    expect(store.active).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(UPLOAD_POLL_MS * 3)
    expect(store.ready).toHaveLength(1)
  })

  it('saves a prepared photo into the wardrobe', async () => {
    const store = useUploadsStore()
    const wardrobe = useWardrobeStore()
    await wardrobe.load()
    const before = wardrobe.items.length
    const [u] = await store.enqueue([photo()])
    await vi.advanceTimersByTimeAsync(UPLOAD_POLL_MS * 3)
    const item = await store.save(u!.id, { name: 'Silk Cami', category: 'tops' })
    expect(store.uploads).toEqual([])
    expect(wardrobe.items).toHaveLength(before + 1)
    expect(wardrobe.items.some((i) => i.id === item.id)).toBe(true)
  })

  it('discards and retries photos', async () => {
    const store = useUploadsStore()
    const [a, b] = await store.enqueue([photo(), photo('b.png')])
    await store.discard(a!.id)
    expect(store.uploads.map((u) => u.id)).toEqual([b!.id])
    vi.spyOn(gateway, 'retryUpload').mockResolvedValueOnce({ ...b!, state: 'queued' })
    await store.retry(b!.id)
    expect(store.uploads[0]!.state).toBe('queued')
  })

  it('reports errors without losing what it knows', async () => {
    const store = useUploadsStore()
    await store.enqueue([photo()])
    vi.spyOn(gateway, 'enqueuePhotos').mockRejectedValueOnce(new Error('Please choose an image file.'))
    await expect(store.enqueue([photo()])).rejects.toThrow('Please choose an image file.')
    expect(store.uploads).toHaveLength(1)
  })
})
