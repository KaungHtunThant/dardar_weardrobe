import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { CategoryId } from '#shared/models/category'
import type { ItemDetailsInput } from '#shared/models/item'
import { isActiveUpload, type Upload } from '#shared/models/upload'
import { useGateway } from '~/gateways/provider'
import { useWardrobeStore } from './wardrobe'

/** How often progress is checked while photos are being prepared. */
export const UPLOAD_POLL_MS = 1200

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Photos being prepared in the background; checks on them only while some are still in progress. */
export const useUploadsStore = defineStore('uploads', () => {
  const uploads = ref<Upload[]>([])
  const loaded = ref(false)
  const error = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined

  const active = computed(() => uploads.value.filter(isActiveUpload))
  const ready = computed(() => uploads.value.filter((u) => u.state === 'ready'))
  const failed = computed(() => uploads.value.filter((u) => u.state === 'failed'))

  function stop() {
    clearTimeout(timer)
    timer = undefined
  }

  function schedule() {
    stop()
    if (active.value.length) timer = setTimeout(() => void refresh(), UPLOAD_POLL_MS)
  }

  async function refresh() {
    try {
      uploads.value = await useGateway().listUploads()
      loaded.value = true
      error.value = null
    } catch (e) {
      error.value = message(e)
    }
    schedule()
  }

  /** Once per app start: photos left in the queue keep being prepared and show up here. */
  async function load() {
    if (!loaded.value) await refresh()
  }

  async function enqueue(files: readonly File[], categoryHint?: CategoryId) {
    const queued = await useGateway().enqueuePhotos([...files], { categoryHint })
    uploads.value = [...uploads.value, ...queued]
    schedule()
    return queued
  }

  function replace(upload: Upload) {
    uploads.value = uploads.value.map((u) => (u.id === upload.id ? upload : u))
  }

  async function retry(id: string) {
    replace(await useGateway().retryUpload(id))
    schedule()
  }

  async function discard(id: string) {
    await useGateway().discardUpload(id)
    uploads.value = uploads.value.filter((u) => u.id !== id)
  }

  /** Saves a prepared photo as a piece; it moves from here into the wardrobe. */
  async function save(id: string, details: ItemDetailsInput) {
    const item = await useGateway().saveUpload(id, details)
    uploads.value = uploads.value.filter((u) => u.id !== id)
    useWardrobeStore().adopt(item)
    return item
  }

  /** After the wardrobe is cleared on the backend. */
  function forget() {
    stop()
    uploads.value = []
  }

  return { uploads, loaded, error, active, ready, failed, load, refresh, enqueue, retry, discard, save, forget, stop }
})
