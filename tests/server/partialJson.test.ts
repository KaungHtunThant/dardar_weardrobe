import { describe, expect, it } from 'vitest'
import { parsePartialJson } from '../../server/ai/partialJson'

describe('parsePartialJson', () => {
  it('parses complete JSON as-is', () => {
    expect(parsePartialJson('{"a":1,"b":[true,null,"x"]}')).toEqual({ a: 1, b: [true, null, 'x'] })
  })

  it('returns undefined before anything usable has arrived', () => {
    expect(parsePartialJson('')).toBeUndefined()
    expect(parsePartialJson('   ')).toBeUndefined()
  })

  it('closes open objects and arrays', () => {
    expect(parsePartialJson('{"title": "Gallery Night", "itemIds": ["a", "b"')).toEqual({ title: 'Gallery Night', itemIds: ['a', 'b'] })
    expect(parsePartialJson('{"rating": {"score": 7, "works": [')).toEqual({ rating: { score: 7, works: [] } })
  })

  it('keeps a string value that is still being written', () => {
    expect(parsePartialJson('{"title": "Gallery Ni')).toEqual({ title: 'Gallery Ni' })
    expect(parsePartialJson('{"rating": {"verdict": "Too safe, and the')).toEqual({ rating: { verdict: 'Too safe, and the' } })
  })

  it('drops an array element that is still being written, so half an id never shows up', () => {
    expect(parsePartialJson('{"itemIds": ["item-linen-tee", "item-bur')).toEqual({ itemIds: ['item-linen-tee'] })
  })

  it('drops a key without a value yet, and an unfinished number or literal', () => {
    expect(parsePartialJson('{"title": "A", "itemI')).toEqual({ title: 'A' })
    expect(parsePartialJson('{"title": "A", "itemIds":')).toEqual({ title: 'A' })
    expect(parsePartialJson('{"title": "A", "score": 7')).toEqual({ title: 'A' })
    expect(parsePartialJson('{"a": tr')).toEqual({})
    expect(parsePartialJson('{"a": [1, 2')).toEqual({ a: [1] })
  })

  it('handles escapes, including a chunk that ends mid-escape', () => {
    expect(parsePartialJson('{"note": "say \\"hi\\" \\u00e9"}')).toEqual({ note: 'say "hi" é' })
    expect(parsePartialJson('{"note": "line\\')).toEqual({ note: 'line' })
    expect(parsePartialJson('{"note": "caf\\u00')).toEqual({ note: 'caf' })
  })

  it('handles nested arrays of objects mid-stream', () => {
    expect(parsePartialJson('{"fixes": [{"removeItemId": null, "note": "Swap the')).toEqual({ fixes: [{ removeItemId: null, note: 'Swap the' }] })
  })

  it('returns undefined for text that is not JSON', () => {
    expect(parsePartialJson('hello')).toBeUndefined()
  })
})
