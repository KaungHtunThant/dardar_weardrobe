import { describe, expect, it } from 'vitest'
import { evenTone } from '#shared/utils/tone'

const luma = (px: Uint8Array, i: number) => 0.2126 * px[i]! + 0.7152 * px[i + 1]! + 0.0722 * px[i + 2]!

describe('evenTone', () => {
  it('brightens a garment shot in dim light, keeping its colour proportions', () => {
    // a dim red garment; the hidden white pixel must not count
    const rgb = Uint8Array.from([90, 30, 30, 120, 40, 40, 255, 255, 255])
    const out = evenTone(rgb, Uint8Array.from([255, 255, 0]))
    expect(luma(out, 3)).toBeGreaterThan(luma(rgb, 3) * 1.2)
    expect(out[3]! / out[4]!).toBeCloseTo(3, 1)
  })

  it('leaves a well-exposed garment exactly as it is (its colour matters)', () => {
    const blush = Uint8Array.from([232, 180, 184, 200, 150, 155])
    expect([...evenTone(blush, Uint8Array.from([255, 255]))]).toEqual([...blush])
  })

  it('does nothing when nothing is visible', () => {
    const rgb = Uint8Array.from([10, 20, 30])
    expect([...evenTone(rgb, Uint8Array.from([0]))]).toEqual([10, 20, 30])
  })
})
