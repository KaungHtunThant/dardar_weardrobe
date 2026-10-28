import { afterEach, describe, expect, it } from 'vitest'
import { ofetch } from 'ofetch'
import { seedItems, seedStyleMatches } from '#shared/fixtures/seed'
import { startApi } from './harness'

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
let api: Awaited<ReturnType<typeof startApi>>
const seed = () => ({ items: structuredClone(seedItems), styleMatches: structuredClone(seedStyleMatches) })

afterEach(async () => api?.stop())

async function status(promise: Promise<unknown>) {
  try {
    await promise
    return 200
  } catch (e) {
    return (e as { status?: number }).status
  }
}

describe('API', () => {
  it('serves uploaded images with their content type', async () => {
    api = await startApi(seed())
    const form = new FormData()
    form.append('photo', new Blob([PNG], { type: 'image/png' }), 'tee.png')
    const photo = await ofetch(`${api.baseURL}/api/photos`, { method: 'POST', body: form })
    const res = await fetch(`${api.baseURL}${photo.cleanImage}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG)
  })

  it('answers 400 for invalid input and 404 for unknown things', async () => {
    api = await startApi(seed())
    expect(await status(ofetch(`${api.baseURL}/api/items`, { method: 'POST', body: { name: '' } }))).toBe(400)
    expect(await status(ofetch(`${api.baseURL}/api/looks/nope/favourite`, { method: 'PUT', body: { isFavourite: true } }))).toBe(404)
    expect(await status(ofetch(`${api.baseURL}/api/images/../../secret`))).toBe(404)
    expect(await status(ofetch(`${api.baseURL}/api/nothing-here`))).toBe(404)
  })

  it('rejects a photo upload without a file', async () => {
    api = await startApi(seed())
    expect(await status(ofetch(`${api.baseURL}/api/photos`, { method: 'POST', body: new FormData() }))).toBe(400)
  })

  it('only allows the reset endpoint when enabled, and then restores the seed', async () => {
    api = await startApi(seed())
    expect(await status(ofetch(`${api.baseURL}/api/dev/reset`, { method: 'POST' }))).toBe(404)
    await api.stop()

    api = await startApi(seed(), { allowReset: true })
    await ofetch(`${api.baseURL}/api/looks/generate`, { method: 'POST', body: { fillCategories: ['tops'] } })
    expect(await ofetch(`${api.baseURL}/api/looks`)).toHaveLength(seedStyleMatches.length + 1)
    await ofetch(`${api.baseURL}/api/dev/reset`, { method: 'POST' })
    expect(await ofetch(`${api.baseURL}/api/looks`)).toHaveLength(seedStyleMatches.length)
  })
})
