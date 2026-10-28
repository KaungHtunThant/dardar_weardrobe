import type { StyleAdvisorRequest, StyleProgress } from '#shared/contracts/StyleAdvisor'
import { clean, pickLook } from './stylePrompt'

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const STAGES: StyleProgress['stage'][] = ['reading', 'picking', 'rating']

/** How far along an answer is: stage, then picks, then verdict, then title. */
function reach(p: StyleProgress): number[] {
  return [STAGES.indexOf(p.stage), p.aiItemIds.length, p.verdict?.length ?? 0, p.title?.length ?? 0]
}

function behind(a: number[], b: number[]) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! < b[i]!
  return false
}

/**
 * Turns the model's half-finished answer (from parsePartialJson) into progress for the UI.
 * Only real pieces the AI may add are reported, and only when something changed. Progress never
 * goes backwards: if the model starts its answer over (the CLI sometimes retries its structured
 * output), the new attempt shows once it has caught up with what is already on screen.
 */
export function styleProgressReporter(request: StyleAdvisorRequest, onProgress?: (progress: StyleProgress) => void) {
  let last = ''
  let shown: number[] = []
  return (partial: unknown) => {
    if (!onProgress || !isObject(partial) || Object.keys(partial).length === 0) return
    const ids = Array.isArray(partial.itemIds) ? partial.itemIds.filter((id): id is string => typeof id === 'string') : []
    const rating = isObject(partial.rating) ? partial.rating : undefined
    const title = typeof partial.title === 'string' ? clean(partial.title, 80) : ''
    const verdict = typeof rating?.verdict === 'string' ? clean(rating.verdict, 240) : ''
    const progress: StyleProgress = {
      stage: rating ? 'rating' : 'picking',
      ...(title ? { title } : {}),
      aiItemIds: pickLook(ids, request).added.map((i) => i.id),
      ...(verdict ? { verdict } : {}),
    }
    const key = JSON.stringify(progress)
    if (key === last || behind(reach(progress), shown)) return
    last = key
    shown = reach(progress)
    onProgress(progress)
  }
}
