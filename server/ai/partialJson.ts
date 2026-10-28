type Kind = 'object' | 'array' | 'string' | 'scalar'
interface Parsed {
  value: unknown
  complete: boolean
  kind: Kind
}

const ESCAPES: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' }
const LITERALS: Record<string, unknown> = { true: true, false: false, null: null }

/** Thrown for text that can never become JSON. */
class NotJson extends Error {}

/** Reads JSON that may stop anywhere, as a model streams it. */
class PartialReader {
  private i = 0
  constructor(private readonly s: string) {}

  eof() {
    return this.i >= this.s.length
  }

  ws() {
    while (!this.eof() && /\s/.test(this.s[this.i]!)) this.i++
  }

  /** A value, or null when nothing usable has arrived yet (an unfinished number or literal). */
  value(): Parsed | null {
    this.ws()
    if (this.eof()) return null
    const c = this.s[this.i]!
    if (c === '{') return this.object()
    if (c === '[') return this.array()
    if (c === '"') return this.string()
    return this.scalar()
  }

  private object(): Parsed {
    const obj: Record<string, unknown> = {}
    const partial = { value: obj, complete: false, kind: 'object' as const }
    this.i++
    for (;;) {
      this.ws()
      if (this.eof()) return partial
      const c = this.s[this.i]!
      if (c === '}') {
        this.i++
        return { ...partial, complete: true }
      }
      if (c === ',') {
        this.i++
        continue
      }
      if (c !== '"') throw new NotJson()
      const key = this.string()
      if (!key.complete) return partial
      this.ws()
      if (this.eof()) return partial
      if (this.s[this.i] !== ':') throw new NotJson()
      this.i++
      const v = this.value()
      if (!v) return partial
      obj[key.value as string] = v.value
      if (!v.complete) return partial
    }
  }

  private array(): Parsed {
    const arr: unknown[] = []
    const partial = { value: arr, complete: false, kind: 'array' as const }
    this.i++
    for (;;) {
      this.ws()
      if (this.eof()) return partial
      const c = this.s[this.i]!
      if (c === ']') {
        this.i++
        return { ...partial, complete: true }
      }
      if (c === ',') {
        this.i++
        continue
      }
      const v = this.value()
      if (!v) return partial
      // Half an object is useful; half a string (an id) is not.
      if (v.complete || v.kind === 'object' || v.kind === 'array') arr.push(v.value)
      if (!v.complete) return partial
    }
  }

  private string(): Parsed {
    let out = ''
    this.i++
    while (!this.eof()) {
      const c = this.s[this.i]!
      if (c === '"') {
        this.i++
        return { value: out, complete: true, kind: 'string' }
      }
      if (c !== '\\') {
        out += c
        this.i++
        continue
      }
      const e = this.s[this.i + 1]
      if (e === undefined) break
      if (e === 'u') {
        const hex = this.s.slice(this.i + 2, this.i + 6)
        if (hex.length < 4) break
        out += String.fromCharCode(Number.parseInt(hex, 16))
        this.i += 6
        continue
      }
      if (!(e in ESCAPES)) throw new NotJson()
      out += ESCAPES[e]
      this.i += 2
    }
    this.i = this.s.length
    return { value: out, complete: false, kind: 'string' }
  }

  private scalar(): Parsed | null {
    const rest = this.s.slice(this.i)
    const literal = Object.keys(LITERALS).find((l) => rest.startsWith(l) || l.startsWith(rest))
    if (literal) {
      if (!rest.startsWith(literal)) return null
      this.i += literal.length
      return { value: LITERALS[literal], complete: true, kind: 'scalar' }
    }
    const m = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(rest)
    if (!m) {
      // `-`, `1.` or `1e` at the very end may still become a number.
      if (/^-?\d*\.?\d*(?:[eE][+-]?)?$/.test(rest)) return null
      throw new NotJson()
    }
    // A number that runs to the end of the text may still be growing (7 → 75).
    if (m[0].length === rest.length) return null
    this.i += m[0].length
    return { value: Number(m[0]), complete: true, kind: 'scalar' }
  }
}

/**
 * Best-effort parse of JSON that a model is still streaming: open objects and arrays are closed,
 * a string value being written is kept as far as it goes, and anything that could still change
 * meaning (a half-written id in an array, a key without a value, an unfinished number) is left out.
 * Returns undefined when nothing usable has arrived or the text isn't JSON.
 */
export function parsePartialJson(text: string): unknown {
  try {
    return new PartialReader(text).value()?.value
  } catch (e) {
    if (e instanceof NotJson) return undefined
    throw e
  }
}
