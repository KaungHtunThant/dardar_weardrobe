import type { DetailsSuggestion } from './GarmentTagger'
import type { Item, ItemDetailsInput } from '../models/item'
import type { StyleMatch } from '../models/styleMatch'
import type { StyleRequestInput } from '../models/styleRequest'
import type { SettingsUpdate, SettingsView } from '../models/settings'

/** Result of preparing an uploaded photo: the original and the garment-only version. */
export interface ProcessedPhoto {
  originalImage: string
  cleanImage: string
  /** False when background removal failed and the clean image is just the original. */
  backgroundRemoved?: boolean
}

export type CreateItemInput = ItemDetailsInput & ProcessedPhoto

export interface ItemGateway {
  listItems(): Promise<Item[]>
  createItem(input: CreateItemInput): Promise<Item>
  /** AI pre-fill for the add-item form, from the clean image; may be empty. */
  suggestDetails(cleanImage: string): Promise<DetailsSuggestion>
}

export interface PhotoGateway {
  /** Removes the background so only the garment remains. */
  removeBackground(photo: Blob): Promise<ProcessedPhoto>
}

export interface StyleMatchGateway {
  listStyleMatches(): Promise<StyleMatch[]>
  /** Today's recommendation for a YYYY-MM-DD date (null with an empty wardrobe). */
  getTodayLook(date: string): Promise<StyleMatch | null>
  setFavourite(id: string, isFavourite: boolean): Promise<StyleMatch>
}

export interface StylingGateway {
  /** Completes the user's picks with AI choices, rates the look and saves it as a style match. */
  generateLook(request: StyleRequestInput): Promise<StyleMatch>
}

export interface SettingsGateway {
  getSettings(): Promise<SettingsView>
  updateSettings(update: SettingsUpdate): Promise<SettingsView>
}

export interface DataGateway {
  /** Deletes every item, photo and look so the user can start fresh. Settings and the API key stay. */
  clearWardrobe(): Promise<void>
}

/** Everything the frontend needs from the outside world. Stores depend on this, never on an implementation. */
export interface WardrobeGateway extends ItemGateway, PhotoGateway, StyleMatchGateway, StylingGateway, SettingsGateway, DataGateway {}
