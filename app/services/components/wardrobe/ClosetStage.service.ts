import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref } from 'vue'
import { getCategory, type CategoryId } from '#shared/models/category'
import type { Item } from '#shared/models/item'
import { pieces } from '~/services/plural'

/** Must match the door transition duration in ClosetStage.vue. */
export const DOOR_MS = 850

type Emit = (event: 'close') => void

export function useClosetStage(props: { category: CategoryId; items: readonly Item[] }, emit: Emit) {
  const doorsOpen = ref(false)
  let closing = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const title = computed(() => getCategory(props.category).label)
  const countLabel = computed(() => pieces(props.items.length))

  function reducedMotion() {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  function open() {
    doorsOpen.value = true
  }

  function requestClose() {
    if (closing) return
    closing = true
    doorsOpen.value = false
    timer = setTimeout(() => emit('close'), reducedMotion() ? 0 : DOOR_MS)
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') requestClose()
  }

  if (getCurrentInstance()) {
    // Two frames so the closed state paints before the doors swing open.
    onMounted(() => {
      requestAnimationFrame(() => requestAnimationFrame(open))
      window.addEventListener('keydown', onKeydown)
    })
    onBeforeUnmount(() => {
      clearTimeout(timer)
      window.removeEventListener('keydown', onKeydown)
    })
  }

  return { doorsOpen, title, countLabel, open, requestClose }
}
