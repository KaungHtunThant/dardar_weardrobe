import type { StyleMatch } from '../models/styleMatch'

export interface StyleMatchRepository {
  findAll(): Promise<StyleMatch[]>
  findById(id: string): Promise<StyleMatch | null>
  insert(match: StyleMatch): Promise<StyleMatch>
  update(match: StyleMatch): Promise<StyleMatch>
  /** Returns whether something was deleted. */
  delete(id: string): Promise<boolean>
}
