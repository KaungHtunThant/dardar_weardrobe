import type { StyleMatchRepository } from '#shared/contracts/StyleMatchRepository'
import { NotFoundError } from '#shared/errors'

export class StyleMatchService {
  constructor(private readonly looks: StyleMatchRepository) {}

  list() {
    return this.looks.findAll()
  }

  async setFavourite(id: string, isFavourite: boolean) {
    const look = await this.looks.findById(id)
    if (!look) throw new NotFoundError(`Look not found: ${id}`)
    return this.looks.update({ ...look, isFavourite })
  }
}
