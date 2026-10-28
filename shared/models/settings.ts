import { z } from 'zod'

export const ADVISOR_MODES = ['claude-cli', 'claude-api', 'offline'] as const
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
export const DEFAULT_MODEL = 'claude-opus-5-5'

export const AdvisorModeSchema = z.enum(ADVISOR_MODES)
export type AdvisorMode = z.infer<typeof AdvisorModeSchema>

/** What the user chooses on the Settings page (persisted). */
export const SettingsSchema = z.object({
  advisor: AdvisorModeSchema,
  /** Used by both the CLI and the API. */
  model: z.string().trim().min(1).max(100).default(DEFAULT_MODEL),
  /** API only: how hard Claude thinks (cost vs. depth). */
  effort: z.enum(EFFORTS).default('medium'),
})
export type Settings = z.infer<typeof SettingsSchema>

/** A partial change; `apiKey: null` removes the stored key. */
export const SettingsUpdateSchema = SettingsSchema.partial().extend({
  apiKey: z.string().trim().min(1).max(500).nullable().optional(),
})
export type SettingsUpdate = z.input<typeof SettingsUpdateSchema>

/** Settings as shown to the UI: never contains the key itself. */
export interface SettingsView extends Settings {
  apiKey: { present: boolean; source: 'env' | 'stored' | null; last4: string | null }
  cli: { available: boolean; version: string | null }
  /** True when the key is encrypted by the OS keychain (packaged app). */
  secureStorage: boolean
}
