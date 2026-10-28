import { eq } from 'drizzle-orm'
import type { StyleMatchRepository } from '#shared/contracts/StyleMatchRepository'
import type { StyleMatch } from '#shared/models/styleMatch'
import type { Db } from '../database/connection'
import { styleMatches } from '../database/schema'

type Row = typeof styleMatches.$inferSelect

function toLook({ aiItemIds, prompt, rating, dailyPickDate, ...rest }: Row): StyleMatch {
  return {
    ...rest,
    ...(aiItemIds != null ? { aiItemIds } : {}),
    ...(prompt != null ? { prompt } : {}),
    ...(rating != null ? { rating } : {}),
    ...(dailyPickDate != null ? { dailyPickDate } : {}),
  }
}

function toRow(look: StyleMatch) {
  return { aiItemIds: null, prompt: null, rating: null, dailyPickDate: null, ...look }
}

export class SqliteStyleMatchRepository implements StyleMatchRepository {
  constructor(private readonly db: Db) {}

  async findAll() {
    return (await this.db.select().from(styleMatches)).map(toLook)
  }

  async findById(id: string) {
    const row = await this.db.select().from(styleMatches).where(eq(styleMatches.id, id)).get()
    return row ? toLook(row) : null
  }

  async insert(look: StyleMatch) {
    await this.db.insert(styleMatches).values(toRow(look))
    return look
  }

  async delete(id: string) {
    const existed = (await this.findById(id)) !== null
    if (existed) await this.db.delete(styleMatches).where(eq(styleMatches.id, id))
    return existed
  }

  async update(look: StyleMatch) {
    const { id, ...rest } = toRow(look)
    await this.db.update(styleMatches).set(rest).where(eq(styleMatches.id, id))
    return look
  }
}
