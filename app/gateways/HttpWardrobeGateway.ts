import { ofetch, type $Fetch } from 'ofetch'
import type { CreateItemInput, ProcessedPhoto, WardrobeGateway } from '#shared/contracts/WardrobeGateway'
import type { Item, ItemDetailsInput } from '#shared/models/item'
import type { StyleMatch } from '#shared/models/styleMatch'
import type { StyleRequestInput } from '#shared/models/styleRequest'
import type { DetailsSuggestion } from '#shared/contracts/GarmentTagger'
import type { SettingsUpdate, SettingsView } from '#shared/models/settings'
import type { DayWeather, Place } from '#shared/models/weather'
import type { GapReport } from '#shared/models/gap'
import type { CategoryId } from '#shared/models/category'
import type { Upload } from '#shared/models/upload'
import type { StyleCallOptions, StyleProgress } from '#shared/contracts/StyleAdvisor'
import { createSseParser } from '#shared/utils/sse'

/** Talks to the local Nitro API (same origin in the app; an explicit base URL in tests). */
export class HttpWardrobeGateway implements WardrobeGateway {
  private readonly api: $Fetch

  constructor(private readonly baseURL = '') {
    this.api = ofetch.create({ baseURL })
  }

  /** Surfaces the server's message (e.g. a validation error) instead of a generic fetch error. */
  private async call<T>(request: () => Promise<T>): Promise<T> {
    try {
      return await request()
    } catch (e) {
      const err = e as { data?: { message?: string }; message?: string }
      throw new Error(err.data?.message ?? err.message ?? 'Request failed', { cause: e })
    }
  }

  listItems() {
    return this.call(() => this.api<Item[]>('/api/items'))
  }

  createItem(input: CreateItemInput) {
    return this.call(() => this.api<Item>('/api/items', { method: 'POST', body: input }))
  }

  updateItem(id: string, details: ItemDetailsInput) {
    return this.call(() => this.api<Item>(`/api/items/${encodeURIComponent(id)}`, { method: 'PATCH', body: details }))
  }

  replaceItemPhoto(id: string, photo: ProcessedPhoto) {
    const { originalImage, cleanImage } = photo
    return this.call(() => this.api<Item>(`/api/items/${encodeURIComponent(id)}/photo`, { method: 'PUT', body: { originalImage, cleanImage } }))
  }

  async deleteItem(id: string) {
    await this.call(() => this.api(`/api/items/${encodeURIComponent(id)}`, { method: 'DELETE' }))
  }

  async deleteLook(id: string) {
    await this.call(() => this.api(`/api/looks/${encodeURIComponent(id)}`, { method: 'DELETE' }))
  }

  suggestDetails(cleanImage: string) {
    return this.call(() => this.api<DetailsSuggestion>('/api/items/suggest', { method: 'POST', body: { image: cleanImage } }))
  }

  async getTodayLook(date: string) {
    return (await this.call(() => this.api<{ look: StyleMatch | null }>('/api/looks/today', { query: { date } }))).look
  }

  removeBackground(photo: Blob) {
    const form = new FormData()
    form.append('photo', photo, (photo as File).name || 'photo')
    return this.call(() => this.api<ProcessedPhoto>('/api/photos', { method: 'POST', body: form }))
  }

  enqueuePhotos(photos: Blob[], { categoryHint }: { categoryHint?: CategoryId } = {}) {
    const form = new FormData()
    for (const photo of photos) form.append('photo', photo, (photo as File).name || 'photo')
    if (categoryHint) form.append('category', categoryHint)
    return this.call(() => this.api<Upload[]>('/api/uploads', { method: 'POST', body: form }))
  }

  /** Polled while photos are prepared; a check that never answers mustn't stop the next one. */
  listUploads() {
    return this.call(() => this.api<Upload[]>('/api/uploads', { timeout: 10_000 }))
  }

  retryUpload(id: string) {
    return this.call(() => this.api<Upload>(`/api/uploads/${encodeURIComponent(id)}/retry`, { method: 'POST' }))
  }

  async discardUpload(id: string) {
    await this.call(() => this.api(`/api/uploads/${encodeURIComponent(id)}`, { method: 'DELETE' }))
  }

  saveUpload(id: string, details: ItemDetailsInput) {
    return this.call(() => this.api<Item>(`/api/uploads/${encodeURIComponent(id)}/save`, { method: 'POST', body: details }))
  }

  listStyleMatches() {
    return this.call(() => this.api<StyleMatch[]>('/api/looks'))
  }

  setFavourite(id: string, isFavourite: boolean) {
    return this.call(() =>
      this.api<StyleMatch>(`/api/looks/${encodeURIComponent(id)}/favourite`, { method: 'PUT', body: { isFavourite } }),
    )
  }

  /** Uses the streaming endpoint so progress shows and the stylist can be cancelled. */
  async generateLook(request: StyleRequestInput, { signal, onProgress }: StyleCallOptions = {}): Promise<StyleMatch> {
    const res = await fetch(`${this.baseURL}/api/looks/generate/stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify(request),
      signal,
    })
    if (!res.ok || !res.body) throw new Error(`Styling failed (${res.status}).`)

    let look: StyleMatch | null = null
    let failure: string | null = null
    const push = createSseParser((event, data) => {
      if (event === 'progress') onProgress?.(data as StyleProgress)
      else if (event === 'done') look = data as StyleMatch
      else if (event === 'error') failure = (data as { message?: string }).message ?? 'Styling failed.'
    })
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      push(decoder.decode(value, { stream: true }))
    }
    if (failure) throw new Error(failure)
    if (!look) throw new Error('The stylist stopped before finishing.')
    return look
  }

  getSettings() {
    return this.call(() => this.api<SettingsView>('/api/settings'))
  }

  updateSettings(update: SettingsUpdate) {
    return this.call(() => this.api<SettingsView>('/api/settings', { method: 'PUT', body: update }))
  }

  recreateAgent() {
    return this.call(() => this.api<SettingsView>('/api/agent/recreate', { method: 'POST' }))
  }

  async getWeather(date: string) {
    return (await this.call(() => this.api<{ weather: DayWeather | null }>('/api/weather', { query: { date } }))).weather
  }

  searchPlaces(query: string) {
    return this.call(() => this.api<Place[]>('/api/places', { query: { q: query } }))
  }

  async locatePlace() {
    return (await this.call(() => this.api<{ place: Place | null }>('/api/places/here'))).place
  }

  async getWardrobeGaps() {
    return (await this.call(() => this.api<{ report: GapReport | null }>('/api/wardrobe/gaps'))).report
  }

  async refreshWardrobeGaps() {
    return (await this.call(() => this.api<{ report: GapReport | null }>('/api/wardrobe/gaps/refresh', { method: 'POST' }))).report
  }

  async clearWardrobe() {
    await this.call(() => this.api('/api/wardrobe/clear', { method: 'POST', body: { confirm: true } }))
  }
}
