import { describe, expect, it } from 'vitest'
import { seedStyleMatches } from '#shared/fixtures/seed'
import { useLookCard } from '~/services/components/home/LookCard.service'

describe('LookCard service', () => {
  it('shows when the look was made and how many pieces it has', () => {
    const look = seedStyleMatches.find((l) => l.id === 'look-cozy-autumn')!
    const vm = useLookCard({ entry: { look, items: [] } })
    expect(vm.dateLabel.value).toBe('26 Oct')
    expect(vm.piecesLabel.value).toBe('5 pieces')
  })

  it('uses the singular for one piece', () => {
    const look = { ...seedStyleMatches[0]!, itemIds: ['a'] }
    expect(useLookCard({ entry: { look, items: [] } }).piecesLabel.value).toBe('1 piece')
  })

  it('shows the rating score when the look was rated', () => {
    const look = { ...seedStyleMatches[0]!, rating: { score: 4, verdict: 'Meh.', works: [], fails: [], fixes: [] } }
    expect(useLookCard({ entry: { look, items: [] } }).scoreLabel.value).toBe('4/10')
    expect(useLookCard({ entry: { look: seedStyleMatches[0]!, items: [] } }).scoreLabel.value).toBeNull()
  })
})
