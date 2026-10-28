import { describe, expect, it } from 'vitest'
import { focusRect, toFocusBox } from '#shared/utils/focusBox'

describe('toFocusBox', () => {
  it('keeps a sensible box as fractions of the image', () => {
    expect(toFocusBox({ x: 0.2, y: 0.25, width: 0.5, height: 0.4 })).toEqual({ x: 0.2, y: 0.25, w: 0.5, h: 0.4 })
  })

  it('clamps a box that spills over the edges', () => {
    expect(toFocusBox({ x: -0.1, y: 0.5, width: 0.6, height: 0.8 })).toEqual({ x: 0, y: 0.5, w: 0.5, h: 0.5 })
  })

  it('reads percentages as fractions', () => {
    expect(toFocusBox({ x: 20, y: 25, width: 50, height: 40 })).toEqual({ x: 0.2, y: 0.25, w: 0.5, h: 0.4 })
  })

  it('drops boxes that are missing, tiny or nonsense', () => {
    expect(toFocusBox(null)).toBeNull()
    expect(toFocusBox({ x: 0.5, y: 0.5, width: 0.05, height: 0.05 })).toBeNull()
    expect(toFocusBox({ x: 'a', y: 0, width: 1, height: 1 })).toBeNull()
    expect(toFocusBox({ x: 1.2, y: 0, width: 0.5, height: 0.5 })).toBeNull()
  })

  it('treats a box covering the whole photo as no focus at all', () => {
    expect(toFocusBox({ x: 0, y: 0, width: 1, height: 1 })).toBeNull()
  })
})

describe('focusRect', () => {
  it('turns a box into whole pixels with a margin around the garment', () => {
    expect(focusRect({ x: 0.2, y: 0.25, w: 0.5, h: 0.4 }, 1000, 2000, 0.1)).toEqual({ left: 150, top: 420, width: 600, height: 960 })
  })

  it('never leaves the image', () => {
    const r = focusRect({ x: 0, y: 0.9, w: 0.3, h: 0.1 }, 400, 600, 0.2)
    expect(r.left).toBe(0)
    expect(r.top + r.height).toBeLessThanOrEqual(600)
    expect(r.left + r.width).toBeLessThanOrEqual(400)
  })
})
