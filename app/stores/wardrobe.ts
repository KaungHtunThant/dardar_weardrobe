import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { CreateItemInput } from '#shared/contracts/WardrobeGateway'
import type { Item } from '#shared/models/item'
import { countByCategory, filterByCategory, sortNewestFirst, type CategoryFilter } from '#shared/utils/wardrobe'
import { useGateway } from '~/gateways/provider'

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const useWardrobeStore = defineStore('wardrobe', () => {
  const raw = ref<Item[]>([])
  const loaded = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let inFlight: Promise<void> | null = null

  const items = computed(() => sortNewestFirst(raw.value))
  const counts = computed(() => countByCategory(raw.value))

  function byCategory(category: CategoryFilter) {
    return filterByCategory(items.value, category)
  }

  function load() {
    if (loaded.value) return Promise.resolve()
    inFlight ??= (async () => {
      loading.value = true
      error.value = null
      try {
        raw.value = await useGateway().listItems()
        loaded.value = true
      } catch (e) {
        error.value = message(e)
      } finally {
        loading.value = false
        inFlight = null
      }
    })()
    return inFlight
  }

  function prepareImage(photo: Blob) {
    return useGateway().removeBackground(photo)
  }

  function suggestDetails(cleanImage: string) {
    return useGateway().suggestDetails(cleanImage)
  }

  /** Deletes everything on the backend and empties this store. */
  async function clearAll() {
    await useGateway().clearWardrobe()
    raw.value = []
    loaded.value = true
  }

  async function addItem(input: CreateItemInput) {
    const item = await useGateway().createItem(input)
    raw.value = [...raw.value, item]
    return item
  }

  return { items, counts, loaded, loading, error, byCategory, load, prepareImage, suggestDetails, addItem, clearAll }
})
