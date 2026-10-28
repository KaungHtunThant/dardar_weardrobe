import type { StyleAdvisor, StyleCallOptions } from '#shared/contracts/StyleAdvisor'
import type { CreateItemInput, ProcessedPhoto, WardrobeGateway } from '#shared/contracts/WardrobeGateway'
import { ItemDetailsSchema, type Item, type ItemDetailsInput } from '#shared/models/item'
import type { StyleMatch } from '#shared/models/styleMatch'
import { StyleRequestSchema, type StyleRequestInput } from '#shared/models/styleRequest'
import { DEFAULT_MODEL, SettingsSchema, SettingsUpdateSchema, type Settings, type SettingsUpdate, type SettingsView } from '#shared/models/settings'
import { RuleBasedStyleAdvisor } from '#shared/advisors/RuleBasedStyleAdvisor'
import { lookFromSuggestion, todaysPick, withoutItem } from '#shared/utils/looks'
import type { SnapshotStore, WardrobeSnapshot } from './persistence/SnapshotStore'

export interface MockGatewayOptions {
  /** Data used the first time the store is empty. */
  seed: WardrobeSnapshot
  /** Simulated network/AI latency so loading states are visible in the prototype. */
  latencyMs?: number
  now?: () => Date
  newId?: () => string
  /** Who completes and rates looks. Defaults to the rule-based (offline) advisor. */
  advisor?: StyleAdvisor
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`
}

/**
 * Prototype gateway: no backend, no AI. Background removal is simulated by returning the photo as-is.
 */
export class MockWardrobeGateway implements WardrobeGateway {
  private snapshot: Promise<WardrobeSnapshot> | null = null
  private readonly latencyMs: number
  private readonly now: () => Date
  private readonly newId: () => string
  private readonly advisor: StyleAdvisor
  /** Prototype only: settings live in memory and every mode styles with the offline advisor. */
  private settings: Settings = { advisor: 'offline', model: DEFAULT_MODEL, effort: 'medium' }
  private apiKey: string | null = null

  constructor(
    private readonly store: SnapshotStore,
    private readonly options: MockGatewayOptions,
  ) {
    this.latencyMs = options.latencyMs ?? 0
    this.now = options.now ?? (() => new Date())
    this.newId = options.newId ?? (() => crypto.randomUUID())
    this.advisor = options.advisor ?? new RuleBasedStyleAdvisor()
  }

  private data() {
    this.snapshot ??= this.store.load().then(async (stored) => {
      if (stored) return stored
      const seeded = structuredClone(this.options.seed)
      await this.store.save(seeded)
      return seeded
    })
    return this.snapshot
  }

  private async persist() {
    await this.store.save(await this.data())
  }

  private wait(factor = 1) {
    const ms = this.latencyMs * factor
    return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve()
  }

  async listItems(): Promise<Item[]> {
    await this.wait()
    return structuredClone((await this.data()).items)
  }

  async createItem(input: CreateItemInput): Promise<Item> {
    const details = ItemDetailsSchema.parse(input)
    const item: Item = {
      ...details,
      id: `item-${this.newId()}`,
      originalImage: input.originalImage,
      cleanImage: input.cleanImage,
      isFavourite: false,
      createdAt: this.now().toISOString(),
    }
    ;(await this.data()).items.push(item)
    await this.persist()
    await this.wait()
    return structuredClone(item)
  }

  private async item(id: string) {
    const item = (await this.data()).items.find((i) => i.id === id)
    if (!item) throw new Error(`Piece not found: ${id}`)
    return item
  }

  async updateItem(id: string, details: ItemDetailsInput) {
    const item = await this.item(id)
    const parsed = ItemDetailsSchema.parse(details)
    // Optional fields left blank in the edit are removed, not kept from before.
    delete item.brand
    delete item.size
    delete item.notes
    Object.assign(item, parsed)
    await this.persist()
    return structuredClone(item)
  }

  async replaceItemPhoto(id: string, photo: ProcessedPhoto) {
    const item = await this.item(id)
    item.originalImage = photo.originalImage
    item.cleanImage = photo.cleanImage
    await this.persist()
    return structuredClone(item)
  }

  async deleteItem(id: string) {
    await this.item(id)
    const data = await this.data()
    data.items = data.items.filter((i) => i.id !== id)
    data.styleMatches = data.styleMatches.flatMap((l) => withoutItem(l, id) ?? [])
    await this.persist()
  }

  async deleteLook(id: string) {
    const data = await this.data()
    if (!data.styleMatches.some((l) => l.id === id)) throw new Error(`Look not found: ${id}`)
    data.styleMatches = data.styleMatches.filter((l) => l.id !== id)
    await this.persist()
  }

  /** Prototype: no vision, so nothing to suggest. */
  async suggestDetails(_cleanImage: string) {
    await this.wait()
    return {}
  }

  /** Prototype: a stable pick from the saved looks (the real backend styles one per day). */
  async getTodayLook(date: string) {
    await this.wait()
    return structuredClone(todaysPick((await this.data()).styleMatches, date))
  }

  async removeBackground(photo: Blob): Promise<ProcessedPhoto> {
    const image = await blobToDataUrl(photo)
    await this.wait(5)
    return { originalImage: image, cleanImage: image }
  }

  async listStyleMatches(): Promise<StyleMatch[]> {
    await this.wait()
    return structuredClone((await this.data()).styleMatches)
  }

  /** Prototype: styles instantly, then replays the AI's picks and verdict as progress, as a real stylist streams them. */
  async generateLook(input: StyleRequestInput, { signal, onProgress }: StyleCallOptions = {}): Promise<StyleMatch> {
    const request = StyleRequestSchema.parse(input)
    signal?.throwIfAborted()
    onProgress?.({ stage: 'reading', aiItemIds: [] })
    const data = await this.data()
    const suggestion = await this.advisor.suggestLook({ wardrobe: data.items, ...request }, { signal })
    const step = async () => {
      await this.wait()
      signal?.throwIfAborted()
    }
    await step()
    const { title, aiItemIds } = suggestion
    for (let n = 1; n <= aiItemIds.length; n++) {
      onProgress?.({ stage: 'picking', title, aiItemIds: aiItemIds.slice(0, n) })
      await step()
    }
    onProgress?.({ stage: 'rating', title, aiItemIds, verdict: suggestion.rating.verdict })
    await step()
    const look = lookFromSuggestion(suggestion, request, `look-${this.newId()}`, this.now())
    data.styleMatches.push(look)
    await this.persist()
    return structuredClone(look)
  }

  async setFavourite(id: string, isFavourite: boolean): Promise<StyleMatch> {
    const look = (await this.data()).styleMatches.find((l) => l.id === id)
    if (!look) throw new Error(`Look not found: ${id}`)
    look.isFavourite = isFavourite
    await this.persist()
    return structuredClone(look)
  }

  private settingsView(): SettingsView {
    return {
      ...this.settings,
      apiKey: { present: Boolean(this.apiKey), source: this.apiKey ? 'stored' : null, last4: this.apiKey?.slice(-4) ?? null },
      cli: { available: false, version: null },
      keyStorage: 'private-file',
    }
  }

  async getSettings() {
    return this.settingsView()
  }

  async updateSettings(update: SettingsUpdate) {
    const { apiKey, ...changes } = SettingsUpdateSchema.parse(update)
    if (apiKey !== undefined) this.apiKey = apiKey
    this.settings = SettingsSchema.parse({ ...this.settings, ...changes })
    return this.settingsView()
  }

  async clearWardrobe() {
    const data = await this.data()
    data.items = []
    data.styleMatches = []
    await this.persist()
  }
}
