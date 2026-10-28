import type { DetailsSuggestion } from './GarmentTagger'
import type { CategoryId } from '../models/category'
import type { Upload } from '../models/upload'
import type { Item, ItemDetailsInput } from '../models/item'
import type { StyleMatch } from '../models/styleMatch'
import type { StyleRequestInput } from '../models/styleRequest'
import type { SettingsUpdate, SettingsView } from '../models/settings'
import type { StyleCallOptions } from './StyleAdvisor'

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
  updateItem(id: string, details: ItemDetailsInput): Promise<Item>
  replaceItemPhoto(id: string, photo: ProcessedPhoto): Promise<Item>
  /** Also removes the piece from every look; looks left empty are deleted. */
  deleteItem(id: string): Promise<void>
  /** AI pre-fill for the add-item form, from the clean image; may be empty. */
  suggestDetails(cleanImage: string): Promise<DetailsSuggestion>
}

export interface PhotoGateway {
  /** Removes the background so only the garment remains. */
  removeBackground(photo: Blob): Promise<ProcessedPhoto>
}

/** Photos prepared in the background so the user can carry on (see Upload). */
export interface UploadGateway {
  /** Saves the photos and queues them; resolves at once. `categoryHint`: the closet they were added from. */
  enqueuePhotos(photos: Blob[], options?: { categoryHint?: CategoryId }): Promise<Upload[]>
  /** Oldest first, with their progress. */
  listUploads(): Promise<Upload[]>
  retryUpload(id: string): Promise<Upload>
  discardUpload(id: string): Promise<void>
  /** Turns a ready photo into a piece with the user's details. */
  saveUpload(id: string, details: ItemDetailsInput): Promise<Item>
}

export interface StyleMatchGateway {
  listStyleMatches(): Promise<StyleMatch[]>
  /** Today's recommendation for a YYYY-MM-DD date (null with an empty wardrobe). */
  getTodayLook(date: string): Promise<StyleMatch | null>
  setFavourite(id: string, isFavourite: boolean): Promise<StyleMatch>
  deleteLook(id: string): Promise<void>
}

export interface StylingGateway {
  /**
   * Completes the user's picks with AI choices, rates the look and saves it as a style match.
   * `onProgress` reports the look as it takes shape; aborting `signal` cancels it and nothing is saved.
   */
  generateLook(request: StyleRequestInput, options?: StyleCallOptions): Promise<StyleMatch>
}

export interface SettingsGateway {
  getSettings(): Promise<SettingsView>
  updateSettings(update: SettingsUpdate): Promise<SettingsView>
  /** Sets the on-device stylist agent up again from scratch. */
  recreateAgent(): Promise<SettingsView>
}

export interface DataGateway {
  /** Deletes every item, photo and look so the user can start fresh. Settings and the API key stay. */
  clearWardrobe(): Promise<void>
}

/** Everything the frontend needs from the outside world. Stores depend on this, never on an implementation. */
export interface WardrobeGateway extends ItemGateway, PhotoGateway, UploadGateway, StyleMatchGateway, StylingGateway, SettingsGateway, DataGateway {}
