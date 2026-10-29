/** Identifies a wardrobe by its pieces (order doesn't matter), so a report can tell when it is out of date. */
export function wardrobeKey(items: readonly { id: string }[]): string {
  let hash = 2166136261
  for (const id of items.map((i) => i.id).sort()) {
    for (const ch of `${id}\n`) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0
  }
  return `${items.length}-${hash.toString(36)}`
}
