import { z } from 'zod'
import type { GarmentAnalysis } from '#shared/contracts/GarmentAnalyst'
import { toFocusBox } from '#shared/utils/focusBox'
import { TAG_INSTRUCTIONS, TagSchema, toDetailsSuggestion } from './tagPrompt'

export const ANALYZE_INSTRUCTIONS = `Task: find the garment in a photo.
- box: the garment's tight bounding box as fractions of the image (x, y of the top-left corner, width, height; each 0–1).
- worn: true if a person is wearing it.
- garment: describe that garment.
${TAG_INSTRUCTIONS.replace('Task: describe a garment.\n', '')}`

/** Model output: nullables instead of optionals, as structured outputs require. */
export const AnalysisSchema = z.object({
  box: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).nullable(),
  worn: z.boolean(),
  garment: TagSchema,
})
export type AnalysisOutput = z.infer<typeof AnalysisSchema>

/** Keeps only what is usable: a clamped box (or none) and tidy details. */
export function toGarmentAnalysis(raw: Partial<Record<keyof AnalysisOutput, unknown>>): GarmentAnalysis {
  return {
    focus: toFocusBox(raw.box),
    worn: raw.worn === true,
    details: raw.garment && typeof raw.garment === 'object' ? toDetailsSuggestion(raw.garment as never) : {},
  }
}
