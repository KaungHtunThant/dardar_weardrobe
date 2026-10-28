import { ofetch, type $Fetch } from 'ofetch'
import type { CreateItemInput, ProcessedPhoto, WardrobeGateway } from '#shared/contracts/WardrobeGateway'
import type { Item } from '#shared/models/item'
import type { StyleMatch } from '#shared/models/styleMatch'
import type { StyleRequestInput } from '#shared/models/styleRequest'

/** Talks to the local Nitro API (same origin in the app; an explicit base URL in tests). */
export class HttpWardrobeGateway implements WardrobeGateway {
  private readonly api: $Fetch

  constructor(baseURL = '') {
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

  removeBackground(photo: Blob) {
    const form = new FormData()
    form.append('photo', photo, (photo as File).name || 'photo')
    return this.call(() => this.api<ProcessedPhoto>('/api/photos', { method: 'POST', body: form }))
  }

  listStyleMatches() {
    return this.call(() => this.api<StyleMatch[]>('/api/looks'))
  }

  setFavourite(id: string, isFavourite: boolean) {
    return this.call(() =>
      this.api<StyleMatch>(`/api/looks/${encodeURIComponent(id)}/favourite`, { method: 'PUT', body: { isFavourite } }),
    )
  }

  generateLook(request: StyleRequestInput) {
    return this.call(() => this.api<StyleMatch>('/api/looks/generate', { method: 'POST', body: request }))
  }
}
