import { describe, expect, it } from 'vitest'
import { CATEGORY_IDS } from '#shared/models/category'
import { clothesLabelsFor, CLOTHES_LABELS } from '#shared/utils/clothesLabels'
import { STUDIO_CANVAS, studioPlacement } from '#shared/utils/studioLayout'
import { alphaBounds, alphaCoverage, combineAlpha, erodeAlpha } from '#shared/utils/alpha'

describe('clothesLabelsFor', () => {
  it('keeps only clothing for every category, never skin or hair', () => {
    for (const c of [...CATEGORY_IDS, undefined]) {
      const labels = clothesLabelsFor(c)
      expect(labels.length).toBeGreaterThan(0)
      for (const l of labels) expect(CLOTHES_LABELS).toContain(l)
      for (const body of ['Background', 'Hair', 'Face', 'Left-arm', 'Right-arm', 'Left-leg', 'Right-leg'] as const) expect(labels).not.toContain(body)
    }
  })

  it('keeps tops and dresses together (the model mixes them up) but not trousers', () => {
    expect(clothesLabelsFor('tops')).toEqual(expect.arrayContaining(['Upper-clothes', 'Dress']))
    expect(clothesLabelsFor('tops')).not.toContain('Pants')
    expect(clothesLabelsFor('shoes')).toEqual(['Left-shoe', 'Right-shoe'])
  })
})

describe('studioPlacement', () => {
  it('fits the garment inside the 5:6 canvas with about 10% padding, centred', () => {
    const p = studioPlacement(400, 300, 'tops')
    expect(STUDIO_CANVAS).toEqual({ width: 800, height: 960 })
    expect(p.width).toBe(640)
    expect(p.height).toBe(480)
    expect(p.left).toBe(80)
    expect(p.top).toBe(240)
  })

  it('fits tall garments by height', () => {
    const p = studioPlacement(200, 800, 'dresses')
    expect(p.height).toBe(768)
    expect(p.top).toBe(96)
    expect(p.left).toBe(Math.round((800 - p.width) / 2))
  })

  it('sits shoes and bags low in the frame, like the samples', () => {
    for (const c of ['shoes', 'bags'] as const) {
      const p = studioPlacement(400, 200, c)
      expect(p.top + p.height).toBe(Math.round(960 * 0.88))
    }
  })

  it('never blows a tiny cut-out up more than 3×', () => {
    const p = studioPlacement(50, 60)
    expect(p.width).toBe(150)
    expect(p.height).toBe(180)
  })
})

describe('alpha helpers', () => {
  // 4×3 alpha: an opaque 2×2 block at x 1–2, y 0–1
  const alpha = Uint8Array.from([0, 255, 255, 0, 0, 255, 255, 0, 0, 0, 0, 0])

  it('finds the bounds of what is visible', () => {
    expect(alphaBounds(alpha, 4, 3)).toEqual({ left: 1, top: 0, width: 2, height: 2 })
    expect(alphaBounds(new Uint8Array(12), 4, 3)).toBeNull()
  })

  it('measures how much of the image is visible', () => {
    expect(alphaCoverage(alpha)).toBeCloseTo(4 / 12)
  })

  it('keeps a pixel only where both the matte and the clothes mask agree', () => {
    const matte = Uint8Array.from([255, 255, 0, 128])
    const clothes = Uint8Array.from([255, 0, 255, 255])
    expect([...combineAlpha(matte, clothes)]).toEqual([255, 0, 0, 128])
  })

  it('reads the clothes mask as a soft threshold, not a hard cut', () => {
    const matte = Uint8Array.from([255, 255, 255])
    const out = combineAlpha(matte, Uint8Array.from([100, 160, 220]))
    expect(out[0]).toBe(0)
    expect(out[1]).toBeGreaterThan(0)
    expect(out[1]).toBeLessThan(255)
    expect(out[2]).toBe(255)
  })

  it('erodes the edge by a pixel to drop halos', () => {
    const block = new Uint8Array(25).fill(255) // 5×5 opaque
    const out = erodeAlpha(block, 5, 5)
    expect(out[0]).toBe(0)
    expect(out[12]).toBe(255)
  })
})
