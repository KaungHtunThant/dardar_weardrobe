import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, type CSSProperties } from 'vue'
import type { CategoryId } from '#shared/models/category'
import type { BodySlot } from '#shared/utils/outfit'
import type { CategoryFilter } from '#shared/utils/wardrobe'
import type { Ghost, PlacedPiece } from '~/services/pages/studio.service'

/** Logical size of the dress form; it is scaled to fit the stage. */
export const FIGURE_W = 480
export const FIGURE_H = 860
export const ZOOM_MIN = 1
export const ZOOM_MAX = 3
export const ZOOM_STEP = 0.25
const FIT_MARGIN = 0.94
const DRAG_THRESHOLD = 4

interface SlotBox {
  /** Top edge in figure pixels. */
  top: number
  height: number
  width: number
  /** Horizontal centre offset from the figure's centre line. */
  x: number
  z: number
  /** Which edge of the garment image hugs the body zone. */
  align: 'top' | 'center' | 'bottom'
}

/** Body zones on the dress form. Outerwear sits behind the top so it reads as an open layer. */
export const SLOT_BOX: Record<BodySlot, SlotBox> = {
  head: { top: -22, height: 86, width: 190, x: 0, z: 40, align: 'bottom' },
  face: { top: 58, height: 40, width: 96, x: 0, z: 45, align: 'center' },
  neck: { top: 104, height: 130, width: 120, x: 0, z: 35, align: 'top' },
  outer: { top: 112, height: 400, width: 330, x: 0, z: 10, align: 'top' },
  torso: { top: 126, height: 270, width: 250, x: 0, z: 25, align: 'top' },
  dress: { top: 120, height: 530, width: 300, x: 0, z: 20, align: 'top' },
  legs: { top: 368, height: 390, width: 300, x: 0, z: 20, align: 'top' },
  feet: { top: 748, height: 104, width: 210, x: 0, z: 30, align: 'bottom' },
  hand: { top: 400, height: 150, width: 130, x: 170, z: 38, align: 'top' },
  wrist: { top: 404, height: 54, width: 64, x: -118, z: 38, align: 'center' },
}

/** Content shorter than the viewport is centred; taller content can't scroll past its edges. */
export function clampPan(pan: number, viewportH: number, contentH: number): number {
  if (contentH <= viewportH) return (viewportH - contentH) / 2
  return Math.min(0, Math.max(viewportH - contentH, pan))
}

/** New pan so the figure point under `anchorY` stays put while the scale changes. */
export function zoomAt(pan: number, anchorY: number, oldScale: number, newScale: number): number {
  return anchorY - ((anchorY - pan) * newScale) / oldScale
}

function boxStyle(slot: BodySlot): CSSProperties {
  const box = SLOT_BOX[slot]
  return {
    top: `${box.top}px`,
    height: `${box.height}px`,
    width: `${box.width}px`,
    left: `${FIGURE_W / 2 + box.x - box.width / 2}px`,
    zIndex: box.z,
  }
}

type Emit = (event: 'focus', id: CategoryId) => void

export function useDressForm(
  props: { placed: readonly PlacedPiece[]; ghosts: readonly Ghost[]; activeCategory: CategoryFilter },
  emit: Emit,
) {
  const viewportEl = ref<HTMLElement | null>(null)
  const viewportH = ref(0)
  const zoom = ref(1)
  const pan = ref(0)
  let drag: { startY: number; startPan: number; moved: boolean } | null = null
  let suppressClick = false

  const fitScale = computed(() => (viewportH.value ? (viewportH.value * FIT_MARGIN) / FIGURE_H : 1))
  const scale = computed(() => fitScale.value * zoom.value)
  const contentH = computed(() => FIGURE_H * scale.value)
  const canScroll = computed(() => contentH.value > viewportH.value + 0.5)
  const zoomLabel = computed(() => `${Math.round(zoom.value * 100)}%`)
  const figureStyle = computed<CSSProperties>(() => ({
    width: `${FIGURE_W}px`,
    height: `${FIGURE_H}px`,
    transform: `translate(-50%, ${pan.value}px) scale(${scale.value})`,
    transformOrigin: 'top center',
  }))

  const pieces = computed(() =>
    props.placed.map((p) => ({
      ...p,
      style: boxStyle(p.slot),
      objectPosition: `center ${SLOT_BOX[p.slot].align}`,
      active: props.activeCategory === p.item.category,
    })),
  )
  const ghostBoxes = computed(() => props.ghosts.map((g) => ({ ...g, style: boxStyle(g.slot), active: props.activeCategory === g.id })))

  function setViewportHeight(h: number) {
    viewportH.value = h
    pan.value = clampPan(pan.value, h, contentH.value)
  }

  function setZoom(next: number, anchorY = viewportH.value / 2) {
    const oldScale = scale.value
    zoom.value = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(next * 100) / 100))
    pan.value = clampPan(zoomAt(pan.value, anchorY, oldScale, scale.value), viewportH.value, contentH.value)
  }

  function zoomIn() {
    setZoom(zoom.value + ZOOM_STEP)
  }

  function zoomOut() {
    setZoom(zoom.value - ZOOM_STEP)
  }

  function fit() {
    zoom.value = 1
    pan.value = clampPan(0, viewportH.value, contentH.value)
  }

  function scrollBy(dy: number) {
    pan.value = clampPan(pan.value - dy, viewportH.value, contentH.value)
  }

  /** Plain wheel scrolls up/down; Ctrl/⌘ + wheel (and trackpad pinch) zooms at the pointer. */
  function onWheel(e: WheelEvent) {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) setZoom(zoom.value * (1 - e.deltaY * 0.002), e.offsetY)
    else scrollBy(e.deltaY)
  }

  function onPointerDown(e: PointerEvent) {
    drag = { startY: e.clientY, startPan: pan.value, moved: false }
    suppressClick = false
  }

  function onPointerMove(e: PointerEvent) {
    if (!drag) return
    const dy = e.clientY - drag.startY
    if (Math.abs(dy) > DRAG_THRESHOLD) drag.moved = true
    if (drag.moved) pan.value = clampPan(drag.startPan + dy, viewportH.value, contentH.value)
  }

  function onPointerUp() {
    suppressClick = drag?.moved ?? false
    drag = null
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === '+' || e.key === '=') zoomIn()
    else if (e.key === '-') zoomOut()
    else if (e.key === '0') fit()
    else if (e.key === 'ArrowDown') scrollBy(60)
    else if (e.key === 'ArrowUp') scrollBy(-60)
    else return
    e.preventDefault()
  }

  /** Clicking a piece or placeholder browses its category (unless the click ended a drag). */
  function focus(id: CategoryId) {
    if (suppressClick) {
      suppressClick = false
      return
    }
    emit('focus', id)
  }

  if (getCurrentInstance()) {
    let observer: ResizeObserver | undefined
    onMounted(() => {
      const el = viewportEl.value
      if (!el) return
      setViewportHeight(el.clientHeight)
      observer = new ResizeObserver(() => setViewportHeight(el.clientHeight))
      observer.observe(el)
      // Wheel must be non-passive to stop the page from scrolling.
      el.addEventListener('wheel', onWheel, { passive: false })
    })
    onBeforeUnmount(() => {
      observer?.disconnect()
      viewportEl.value?.removeEventListener('wheel', onWheel)
    })
  }

  return {
    viewportEl,
    zoom,
    pan,
    scale,
    canScroll,
    zoomLabel,
    figureStyle,
    pieces,
    ghostBoxes,
    setViewportHeight,
    zoomIn,
    zoomOut,
    fit,
    scrollBy,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onKeydown,
    focus,
  }
}
