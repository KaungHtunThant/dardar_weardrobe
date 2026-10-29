import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { CategoryId } from '#shared/models/category'
import type { Occasion, Season } from '#shared/models/item'
import type { StyleRating } from '#shared/models/styleMatch'
import type { DetailsSuggestion } from '#shared/contracts/GarmentTagger'
import type { UploadStage, UploadState } from '#shared/models/upload'
import type { DayWeather } from '#shared/models/weather'

export const items = sqliteTable('items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').$type<CategoryId>().notNull(),
  originalImage: text('original_image').notNull(),
  cleanImage: text('clean_image').notNull(),
  colors: text('colors', { mode: 'json' }).$type<string[]>().notNull(),
  brand: text('brand'),
  size: text('size'),
  seasons: text('seasons', { mode: 'json' }).$type<Season[]>().notNull(),
  occasions: text('occasions', { mode: 'json' }).$type<Occasion[]>().notNull(),
  notes: text('notes'),
  isFavourite: integer('is_favourite', { mode: 'boolean' }).notNull(),
  createdAt: text('created_at').notNull(),
})

export const styleMatches = sqliteTable('style_matches', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  itemIds: text('item_ids', { mode: 'json' }).$type<string[]>().notNull(),
  aiItemIds: text('ai_item_ids', { mode: 'json' }).$type<string[]>(),
  prompt: text('prompt'),
  explanation: text('explanation').notNull(),
  rating: text('rating', { mode: 'json' }).$type<StyleRating>(),
  isFavourite: integer('is_favourite', { mode: 'boolean' }).notNull(),
  dailyPickDate: text('daily_pick_date'),
  weather: text('weather', { mode: 'json' }).$type<DayWeather>(),
  createdAt: text('created_at').notNull(),
})

export const uploads = sqliteTable('uploads', {
  id: text('id').primaryKey(),
  originalImage: text('original_image').notNull(),
  cleanImage: text('clean_image'),
  state: text('state').$type<UploadState>().notNull(),
  stage: text('stage').$type<UploadStage>(),
  categoryHint: text('category_hint').$type<CategoryId>(),
  suggestion: text('suggestion', { mode: 'json' }).$type<DetailsSuggestion>(),
  backgroundRemoved: integer('background_removed', { mode: 'boolean' }).notNull(),
  error: text('error'),
  createdAt: text('created_at').notNull(),
})
