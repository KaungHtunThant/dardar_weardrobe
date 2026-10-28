import { computed, ref } from 'vue'
import type { Upload } from '#shared/models/upload'
import { useUploadsStore } from '~/stores/uploads'
import { onViewMounted } from '~/services/lifecycle'
import { pieces } from '~/services/plural'

export interface TrayEntry {
  id: string
  image: string
  status: string
  state: Upload['state']
  canReview: boolean
  canRetry: boolean
}

function statusOf(u: Upload): string {
  if (u.state === 'queued') return 'Waiting…'
  if (u.state === 'processing') return u.stage === 'isolating' ? 'Cutting it out…' : 'Dardar is looking…'
  if (u.state === 'ready') return 'Ready to add'
  return u.error ?? "Couldn't prepare this photo"
}

/** The upload tray: what Dardar is preparing in the background, and the photos ready to review. */
export function useUploadTray() {
  const store = useUploadsStore()
  const open = ref(false)
  const reviewingId = ref<string | null>(null)

  const visible = computed(() => store.uploads.length > 0)
  const readyCount = computed(() => store.ready.length)
  const busy = computed(() => store.active.length > 0)
  const summary = computed(() =>
    [
      store.active.length && `Preparing ${pieces(store.active.length)}`,
      store.ready.length && `${store.ready.length} ready to add`,
      store.failed.length && `${store.failed.length} ${store.failed.length === 1 ? 'needs' : 'need'} a look`,
    ]
      .filter(Boolean)
      .join(' · '),
  )
  const entries = computed<TrayEntry[]>(() =>
    store.uploads.map((u) => ({
      id: u.id,
      image: u.cleanImage ?? u.originalImage,
      status: statusOf(u),
      state: u.state,
      canReview: u.state === 'ready',
      canRetry: u.state === 'failed',
    })),
  )
  const reviewing = computed(() => store.uploads.find((u) => u.id === reviewingId.value) ?? null)

  function toggle() {
    open.value = !open.value
  }

  function review(id: string) {
    reviewingId.value = id
    open.value = false
  }

  function setReviewOpen(isOpen: boolean) {
    if (!isOpen) reviewingId.value = null
  }

  function retry(id: string) {
    return store.retry(id)
  }

  function discard(id: string) {
    return store.discard(id)
  }

  async function init() {
    await store.load()
  }

  onViewMounted(init)

  return { visible, busy, summary, readyCount, entries, open, reviewing, init, toggle, review, setReviewOpen, retry, discard }
}
