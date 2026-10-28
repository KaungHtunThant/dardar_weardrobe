// Stands in for @imgly/background-removal-node inside the worker: answers with the input reversed,
// fails on a single 0 byte, and blocks for a while on a single 1 byte (to check the main thread stays free).
export async function removeBackground(blob, config) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  if (bytes.length === 1 && bytes[0] === 0) throw new Error('model exploded')
  if (bytes.length === 1 && bytes[0] === 1) {
    const until = Date.now() + 400
    while (Date.now() < until);
  }
  if (!config.publicPath) throw new Error('no publicPath')
  return new Blob([bytes.reverse()], { type: 'image/png' })
}
