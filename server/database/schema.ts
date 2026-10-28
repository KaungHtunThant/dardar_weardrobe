import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { CategoryId } from '#shared/models/category'
import type { Occasion, Season } from '#shared/models/item'
import type { StyleRating } from '#shared/models/styleMatch'

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
  createdAt: text('created_at').notNull(),
})
