import type { StyleAdvisor } from '#shared/contracts/StyleAdvisor'
import type { CreateItemInput, ProcessedPhoto, WardrobeGateway } from '#shared/contracts/WardrobeGateway'
import { ItemDetailsSchema, type Item } from '#shared/models/item'
import type { StyleMatch } from '#shared/models/styleMatch'
import { StyleRequestSchema, type StyleRequestInput } from '#shared/models/styleRequest'
import { MockStyleAdvisor } from './mock/MockStyleAdvisor'
import type { SnapshotStore, WardrobeSnapshot } from './persistence/SnapshotStore'

export interface MockGatewayOptions {
  /** Data used the first time the store is empty. */
  seed: WardrobeSnapshot
  /** Simulated network/AI latency so loading states are visible in the prototype. */
  latencyMs?: number
  now?: () => Date
  newId?: () => string
  /** Who completes and rates looks. Defaults to the rule-based prototype advisor. */
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

  constructor(
    private readonly store: SnapshotStore,
    private readonly options: MockGatewayOptions,
  ) {
    this.latencyMs = options.latencyMs ?? 0
    this.now = options.now ?? (() => new Date())
    this.newId = options.newId ?? (() => crypto.randomUUID())
    this.advisor = options.advisor ?? new MockStyleAdvisor()
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

  async removeBackground(photo: Blob): Promise<ProcessedPhoto> {
    const image = await blobToDataUrl(photo)
    await this.wait(5)
    return { originalImage: image, cleanImage: image }
  }

  async listStyleMatches(): Promise<StyleMatch[]> {
    await this.wait()
    return structuredClone((await this.data()).styleMatches)
  }

  async generateLook(input: StyleRequestInput): Promise<StyleMatch> {
    const request = StyleRequestSchema.parse(input)
    const data = await this.data()
    const suggestion = await this.advisor.suggestLook({ wardrobe: data.items, ...request })
    const look: StyleMatch = {
      id: `look-${this.newId()}`,
      title: suggestion.title,
      itemIds: suggestion.itemIds,
      aiItemIds: suggestion.aiItemIds,
      ...(request.prompt ? { prompt: request.prompt } : {}),
      explanation: suggestion.explanation,
      rating: suggestion.rating,
      isFavourite: false,
      createdAt: this.now().toISOString(),
    }
    data.styleMatches.push(look)
    await this.persist()
    await this.wait(6)
    return structuredClone(look)
  }

  async setFavourite(id: string, isFavourite: boolean): Promise<StyleMatch> {
    const look = (await this.data()).styleMatches.find((l) => l.id === id)
    if (!look) throw new Error(`Look not found: ${id}`)
    look.isFavourite = isFavourite
    await this.persist()
    return structuredClone(look)
  }
}
