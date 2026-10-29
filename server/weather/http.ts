import type { WeatherCallOptions } from '#shared/contracts/WeatherProvider'

export type Fetch = typeof fetch

export interface WebServiceOptions {
  /** Injected so tests never touch the network. */
  fetch?: Fetch
  /** A slow service must never hold up styling. */
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 5000

/** GETs JSON with a timeout; the caller's signal cancels it too. Non-2xx answers throw unless `accept` takes them. */
export async function getJson(
  url: URL,
  { fetch: doFetch = fetch, timeoutMs = DEFAULT_TIMEOUT_MS }: WebServiceOptions,
  { signal }: WeatherCallOptions = {},
  accept: (status: number) => boolean = () => false,
): Promise<{ status: number; body: unknown }> {
  signal?.throwIfAborted()
  const signals = [AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])]
  const res = await doFetch(url, { signal: AbortSignal.any(signals), headers: { accept: 'application/json' } })
  if (!res.ok && !accept(res.status)) throw new Error(`${url.hostname} answered ${res.status}`)
  return { status: res.status, body: await res.json() }
}
