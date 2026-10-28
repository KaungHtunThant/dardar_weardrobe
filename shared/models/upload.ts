import type { DetailsSuggestion } from '../contracts/GarmentTagger'
import type { CategoryId } from './category'

export const UPLOAD_STATES = ['queued', 'processing', 'ready', 'failed'] as const
export type UploadState = (typeof UPLOAD_STATES)[number]

/** What the stylist is doing with a photo right now. */
export const UPLOAD_STAGES = ['analyzing', 'isolating'] as const
export type UploadStage = (typeof UPLOAD_STAGES)[number]

/** A photo being prepared in the background, until the user saves it as a piece (or discards it). */
export interface Upload {
  id: string
  originalImage: string
  /** The cut-out garment, once ready (the original if cutting out failed). */
  cleanImage: string | null
  state: UploadState
  stage: UploadStage | null
  /** The closet it was added from, used when the stylist can't tell the category. */
  categoryHint: CategoryId | null
  /** The stylist's details for the form. */
  suggestion: DetailsSuggestion | null
  backgroundRemoved: boolean
  error: string | null
  createdAt: string
}

export const isActiveUpload = (u: Pick<Upload, 'state'>) => u.state === 'queued' || u.state === 'processing'
