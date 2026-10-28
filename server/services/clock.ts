import { randomUUID } from 'node:crypto'

/** Time and id source, injectable for tests. */
export interface Clock {
  now(): Date
  newId(): string
}

export const systemClock: Clock = { now: () => new Date(), newId: () => randomUUID() }
