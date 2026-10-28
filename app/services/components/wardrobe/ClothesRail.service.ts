import { computed, onBeforeUnmount, ref, watch } from 'vue'
import emblaCarouselVue from 'embla-carousel-vue'
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures'
import type { CategoryId } from '#shared/models/category'
import type { Item } from '#shared/models/item'

export type Storage = 'hang' | 'shelf'

const SHELVED: CategoryId[] = ['shoes', 'bags', 'accessories']

/** Clothes hang from the rail; shoes, bags and accessories sit on a shelf. */
export function storageFor(category: CategoryId): Storage {
  return SHELVED.includes(category) ? 'shelf' : 'hang'
}

export function useClothesRail(props: { items: readonly Item[]; category: CategoryId }) {
  // Horizontal only: drag, swipe, or the (vertical) mouse wheel move along the rail.
  const [emblaRef, emblaApi] = emblaCarouselVue(
    { dragFree: true, align: 'start', containScroll: 'trimSnaps', skipSnaps: true },
    [WheelGesturesPlugin({ forceWheelAxis: 'y' })],
  )
  const canPrev = ref(false)
  const canNext = ref(false)
  const storage = computed(() => storageFor(props.category))

  function sync() {
    canPrev.value = emblaApi.value?.canScrollPrev() ?? false
    canNext.value = emblaApi.value?.canScrollNext() ?? false
  }

  watch(emblaApi, (api) => {
    if (!api) return
    api.on('init', sync).on('reInit', sync).on('select', sync).on('scroll', sync)
    sync()
  })
  watch(() => props.items.length, () => emblaApi.value?.reInit())

  function prev() {
    emblaApi.value?.scrollPrev()
  }

  function next() {
    emblaApi.value?.scrollNext()
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') prev()
    if (e.key === 'ArrowRight') next()
  }

  onBeforeUnmount(() => emblaApi.value?.destroy())

  return { emblaRef, canPrev, canNext, storage, prev, next, onKeydown }
}
