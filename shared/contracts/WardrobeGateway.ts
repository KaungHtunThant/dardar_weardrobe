import type { Item, ItemDetailsInput } from '../models/item'
import type { StyleMatch } from '../models/styleMatch'

/** Result of preparing an uploaded photo: the original and the garment-only version. */
export interface ProcessedPhoto {
  originalImage: string
  cleanImage: string
}

export type CreateItemInput = ItemDetailsInput & ProcessedPhoto

export interface ItemGateway {
  listItems(): Promise<Item[]>
  createItem(input: CreateItemInput): Promise<Item>
}

export interface PhotoGateway {
  /** Removes the background so only the garment remains. */
  removeBackground(photo: Blob): Promise<ProcessedPhoto>
}

export interface StyleMatchGateway {
  listStyleMatches(): Promise<StyleMatch[]>
  setFavourite(id: string, isFavourite: boolean): Promise<StyleMatch>
}

/** Everything the frontend needs from the outside world. Stores depend on this, never on an implementation. */
export interface WardrobeGateway extends ItemGateway, PhotoGateway, StyleMatchGateway {}
