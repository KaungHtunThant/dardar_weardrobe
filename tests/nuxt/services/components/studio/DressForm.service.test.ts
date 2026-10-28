import { describe, expect, it, vi } from 'vitest'
import { seedItems } from '#shared/fixtures/seed'
import type { PlacedPiece } from '~/services/pages/studio.service'
import { FIGURE_H, SLOT_BOX, clampPan, useDressForm, zoomAt } from '~/services/components/studio/DressForm.service'

const tee = seedItems.find((i) => i.id === 'item-linen-tee')!
const boots = seedItems.find((i) => i.id === 'item-ankle-boots')!
const placed: PlacedPiece[] = [
  { item: tee, slot: 'torso', isAi: false },
  { item: boots, slot: 'feet', isAi: true },
]

function setup(activeCategory: string = 'all') {
  const emit = vi.fn()
  const vm = useDressForm({ placed, ghosts: [{ id: 'bags', label: 'Bags', slot: 'hand' }], activeCategory: activeCategory as never }, emit)
  vm.setViewportHeight(800)
  return { vm, emit }
}

describe('clampPan', () => {
  it('centres content that fits', () => {
    expect(clampPan(-500, 800, 600)).toBe(100)
  })

  it('keeps taller content inside the viewport', () => {
    expect(clampPan(50, 800, 1600)).toBe(0)
    expect(clampPan(-2000, 800, 1600)).toBe(-800)
    expect(clampPan(-300, 800, 1600)).toBe(-300)
  })
})

describe('zoomAt', () => {
  it('keeps the point under the anchor still', () => {
    const pan = zoomAt(-100, 400, 1, 2)
    expect((400 - -100) / 1).toBeCloseTo((400 - pan) / 2)
  })
})

describe('DressForm service', () => {
  it('fits the whole figure at 100% with nothing to scroll', () => {
    const { vm } = setup()
    expect(vm.zoomLabel.value).toBe('100%')
    expect(vm.canScroll.value).toBe(false)
    const before = vm.pan.value
    vm.scrollBy(200)
    expect(vm.pan.value).toBe(before)
  })

  it('zooms in and out within limits', () => {
    const { vm } = setup()
    vm.zoomOut()
    expect(vm.zoomLabel.value).toBe('100%')
    vm.zoomIn()
    vm.zoomIn()
    expect(vm.zoomLabel.value).toBe('150%')
    for (let i = 0; i < 20; i++) vm.zoomIn()
    expect(vm.zoomLabel.value).toBe('300%')
  })

  it('scrolls up and down once zoomed in, never past head or feet', () => {
    const { vm } = setup()
    vm.zoomIn()
    vm.zoomIn()
    expect(vm.canScroll.value).toBe(true)
    vm.fit()
    vm.zoomIn()
    vm.zoomIn()
    vm.scrollBy(-10_000)
    expect(vm.pan.value).toBe(0)
    vm.scrollBy(10_000)
    const contentH = FIGURE_H * vm.scale.value
    expect(vm.pan.value).toBeCloseTo(800 - contentH)
  })

  it('fit resets zoom and position', () => {
    const { vm } = setup()
    vm.zoomIn()
    vm.scrollBy(300)
    vm.fit()
    expect(vm.zoomLabel.value).toBe('100%')
    expect(vm.canScroll.value).toBe(false)
  })

  it('zooms with ctrl + wheel and scrolls with a plain wheel', () => {
    const { vm } = setup()
    const wheel = (deltaY: number, ctrlKey = false) =>
      vm.onWheel({ deltaY, ctrlKey, metaKey: false, offsetY: 400, preventDefault() {} } as unknown as WheelEvent)
    wheel(-300, true)
    expect(vm.zoomLabel.value).not.toBe('100%')
    const pan = vm.pan.value
    wheel(200)
    expect(vm.pan.value).toBeLessThan(pan)
  })

  it('positions each piece in its body slot and marks the active category', () => {
    const { vm } = setup('shoes')
    const top = vm.pieces.value.find((p) => p.item.id === tee.id)!
    expect(top.style.top).toBe(`${SLOT_BOX.torso.top}px`)
    expect(vm.pieces.value.find((p) => p.item.id === boots.id)!.active).toBe(true)
    expect(top.active).toBe(false)
    expect(vm.ghostBoxes.value[0]!.style.top).toBe(`${SLOT_BOX.hand.top}px`)
  })

  it('emits focus on click but not after a drag', () => {
    const { vm, emit } = setup()
    vm.focus('tops')
    expect(emit).toHaveBeenCalledWith('focus', 'tops')
    emit.mockClear()
    vm.onPointerDown({ clientY: 100, pointerId: 1 } as PointerEvent)
    vm.onPointerMove({ clientY: 160, pointerId: 1 } as PointerEvent)
    vm.onPointerUp()
    vm.focus('tops')
    expect(emit).not.toHaveBeenCalled()
  })
})
