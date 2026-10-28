import { describe, expect, it } from 'vitest'
import { createSseParser } from '#shared/utils/sse'

describe('createSseParser', () => {
  it('emits events with JSON data, across chunk boundaries', () => {
    const seen: { event: string; data: unknown }[] = []
    const push = createSseParser((event, data) => seen.push({ event, data }))
    const wire = 'event: progress\ndata: {"stage":"reading"}\n\nevent: done\ndata: {"id":"look-1"}\n\n'
    for (let i = 0; i < wire.length; i += 7) push(wire.slice(i, i + 7))
    expect(seen).toEqual([
      { event: 'progress', data: { stage: 'reading' } },
      { event: 'done', data: { id: 'look-1' } },
    ])
  })

  it('handles CRLF, comments, a default event name and non-JSON data', () => {
    const seen: { event: string; data: unknown }[] = []
    const push = createSseParser((event, data) => seen.push({ event, data }))
    push(': keep-alive\r\n\r\ndata: hello\r\n\r\n')
    expect(seen).toEqual([{ event: 'message', data: 'hello' }])
  })
})
