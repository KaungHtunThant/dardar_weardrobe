/**
 * Incremental reader for text/event-stream: feed it chunks as they arrive and it calls `onEvent`
 * for each complete event. `data` is parsed as JSON when it is JSON.
 */
export function createSseParser(onEvent: (event: string, data: unknown) => void) {
  let buffer = ''
  const dispatch = (block: string) => {
    let event = 'message'
    const data: string[] = []
    for (const line of block.split('\n')) {
      if (line.startsWith(':')) continue
      const colon = line.indexOf(':')
      const field = colon < 0 ? line : line.slice(0, colon)
      const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '')
      if (field === 'event') event = value
      else if (field === 'data') data.push(value)
    }
    if (!data.length) return
    const text = data.join('\n')
    let parsed: unknown = text
    try {
      parsed = JSON.parse(text)
    } catch {
      // plain text data
    }
    onEvent(event, parsed)
  }
  return (chunk: string) => {
    buffer += chunk.replace(/\r\n?/g, '\n')
    let end
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      dispatch(buffer.slice(0, end))
      buffer = buffer.slice(end + 2)
    }
  }
}
