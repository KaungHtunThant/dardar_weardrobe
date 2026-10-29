import type { GapAdvisor, GapAdvisorRequest, GapCallOptions } from '../contracts/GapAdvisor'
import type { CategoryId } from '../models/category'
import type { GapSuggestion } from '../models/gap'
import type { Item, Occasion, Season } from '../models/item'
import { feelOf, isWet } from '../utils/weather'

/**
 * The "Offline" gap finder: a capsule-wardrobe checklist. Missing essentials come first, then the
 * staples that suit the climate where the user lives, then the rest. Needs no network.
 */

type Climate = 'cold' | 'warm' | 'wet'

interface Staple {
  category: CategoryId
  name: string
  colors: string[]
  seasons: Season[]
  occasions: Occasion[]
  /** Only urgent in this climate; elsewhere it waits until the climate is unknown. */
  climate?: Climate
  reason: string
  /** Whether the wardrobe already has it (by name, colour and category). */
  has: (items: readonly Item[]) => boolean
}

const named = (re: RegExp, colours?: string[]) => (items: readonly Item[]) =>
  items.some((i) => re.test(i.name.toLowerCase()) && (!colours || i.colors.some((c) => colours.includes(c.toLowerCase()))))
const inCategory = (category: CategoryId, test: (items: readonly Item[]) => boolean) => (items: readonly Item[]) =>
  test(items.filter((i) => i.category === category))

const LIGHT = ['white', 'ivory', 'cream', 'light blue']

const STAPLES: readonly Staple[] = [
  { category: 'tops', name: 'White T-Shirt', colors: ['white'], seasons: ['spring', 'summer', 'autumn'], occasions: ['casual'], reason: 'The plain white tee is the base layer half your casual looks are waiting for.', has: inCategory('tops', named(/\b(tee|t-shirt|tshirt)\b/, LIGHT)) },
  { category: 'tops', name: 'Crisp White Shirt', colors: ['white'], seasons: ['spring', 'summer', 'autumn', 'winter'], occasions: ['work', 'casual'], reason: 'Works with jeans, tailoring and under knitwear. Nothing you own does all three.', has: inCategory('tops', named(/\b(shirt|button[- ]?down|oxford)\b/, LIGHT)) },
  { category: 'tops', name: 'Fine-Knit Jumper', colors: ['camel'], seasons: ['autumn', 'winter'], occasions: ['casual', 'work'], climate: 'cold', reason: 'A warm layer that still looks polished at a desk.', has: inCategory('tops', named(/\b(knit|jumper|sweater|cardigan|pullover)\b/)) },
  { category: 'bottoms', name: 'Straight-Leg Jeans', colors: ['denim blue'], seasons: ['spring', 'autumn', 'winter'], occasions: ['casual'], reason: 'The one pair of trousers that goes with almost every top you own.', has: inCategory('bottoms', named(/\b(jeans|denim)\b/)) },
  { category: 'bottoms', name: 'Tailored Trousers', colors: ['black'], seasons: ['spring', 'autumn', 'winter'], occasions: ['work', 'formal'], reason: 'Without them, every smart occasion starts with a panic.', has: (items) => items.some((i) => i.category === 'bottoms' && /\b(trousers|pants|slacks)\b/.test(i.name.toLowerCase()) && i.occasions.some((o) => o === 'work' || o === 'formal')) },
  { category: 'dresses', name: 'Little Black Dress', colors: ['black'], seasons: ['spring', 'summer', 'autumn', 'winter'], occasions: ['evening', 'party', 'formal'], reason: 'One dress that answers every invitation you didn’t see coming.', has: (items) => items.some((i) => i.category === 'dresses' && i.colors.some((c) => c.toLowerCase() === 'black')) },
  { category: 'outerwear', name: 'Warm Wool Coat', colors: ['camel'], seasons: ['winter'], occasions: ['work', 'casual'], climate: 'cold', reason: 'Nothing you own is warm enough for real winter.', has: (items) => items.some((i) => i.category === 'outerwear' && i.seasons.includes('winter')) },
  { category: 'outerwear', name: 'Tailored Blazer', colors: ['black'], seasons: ['spring', 'summer', 'autumn', 'winter'], occasions: ['work', 'evening'], reason: 'Turns trousers and a top into an outfit; your smart looks have nothing to finish them.', has: inCategory('outerwear', named(/\b(blazer|suit jacket)\b/)) },
  { category: 'outerwear', name: 'Classic Trench Coat', colors: ['beige'], seasons: ['spring', 'autumn'], occasions: ['work', 'casual'], climate: 'wet', reason: 'A light coat for rain that looks better than an umbrella.', has: inCategory('outerwear', named(/\b(trench|mac|raincoat|rain jacket)\b/)) },
  { category: 'shoes', name: 'White Leather Trainers', colors: ['white'], seasons: ['spring', 'summer', 'autumn'], occasions: ['casual'], reason: 'The everyday shoe that makes every casual look work.', has: inCategory('shoes', named(/\b(sneakers?|trainers?)\b/)) },
  { category: 'shoes', name: 'Black Ankle Boots', colors: ['black'], seasons: ['autumn', 'winter'], occasions: ['casual', 'work'], climate: 'cold', reason: 'Cold or wet days need a shoe that can take them.', has: inCategory('shoes', named(/\bboots?\b/)) },
  { category: 'shoes', name: 'Flat Leather Sandals', colors: ['tan'], seasons: ['summer'], occasions: ['casual'], climate: 'warm', reason: 'Hot days in closed shoes are a choice you don’t have to make.', has: inCategory('shoes', named(/\b(sandals?|slides?|espadrilles?|mules?)\b/)) },
  { category: 'shoes', name: 'Classic Pumps', colors: ['nude'], seasons: ['spring', 'summer', 'autumn', 'winter'], occasions: ['work', 'evening', 'formal'], reason: 'Dressier looks fall flat in trainers.', has: inCategory('shoes', named(/\b(pumps?|heels?|courts?|slingbacks?)\b/)) },
  { category: 'bags', name: 'Everyday Leather Tote', colors: ['black'], seasons: ['spring', 'summer', 'autumn', 'winter'], occasions: ['work', 'casual'], reason: 'A bag big enough for the day that still looks put together.', has: inCategory('bags', named(/\b(tote|shopper|work bag|handbag)\b/)) },
  { category: 'bags', name: 'Evening Clutch', colors: ['gold'], seasons: ['spring', 'summer', 'autumn', 'winter'], occasions: ['evening', 'party'], reason: 'Your evening looks are carrying a day bag.', has: (items) => items.some((i) => i.category === 'bags' && (/\b(clutch|mini|evening)\b/.test(i.name.toLowerCase()) || i.occasions.includes('evening'))) },
  { category: 'accessories', name: 'Black Leather Belt', colors: ['black'], seasons: ['spring', 'summer', 'autumn', 'winter'], occasions: ['work', 'casual'], reason: 'Defines the waist and finishes trousers and jeans; you have none.', has: inCategory('accessories', named(/\bbelt\b/)) },
]

/** Categories a working wardrobe can't do without. */
const ESSENTIAL: readonly CategoryId[] = ['tops', 'bottoms', 'outerwear', 'shoes', 'bags']
const LIMIT = 5

const NEUTRALS = new Set(['white', 'black', 'cream', 'ivory', 'grey', 'gray', 'navy', 'camel', 'beige', 'nude', 'tan', 'brown', 'denim blue', 'light blue'])

function climatesOf(request: GapAdvisorRequest): Set<Climate> | null {
  const w = request.weather
  if (!w) return null
  const feel = feelOf(w)
  const out = new Set<Climate>()
  if (feel === 'cold' || feel === 'cool') out.add('cold')
  if (feel === 'warm' || feel === 'hot') out.add('warm')
  if (isWet(w)) out.add('wet')
  return out
}

/** Up to three owned pieces it would be worn with: other categories, one each, sharing an occasion. */
function pairsFor(staple: Staple, wardrobe: readonly Item[]): string[] {
  const score = (i: Item) =>
    2 * i.occasions.filter((o) => staple.occasions.includes(o)).length +
    (i.seasons.length === 0 || i.seasons.some((s) => staple.seasons.includes(s)) ? 1 : -2) +
    (i.colors.every((c) => NEUTRALS.has(c.toLowerCase())) ? 1 : 0)
  const candidates = wardrobe
    .filter((i) => i.category !== staple.category && i.occasions.some((o) => staple.occasions.includes(o)))
    .sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))
  const picked: Item[] = []
  for (const item of candidates) {
    if (picked.length === 3) break
    if (!picked.some((p) => p.category === item.category)) picked.push(item)
  }
  return picked.map((i) => i.id)
}

export class RuleBasedGapAdvisor implements GapAdvisor {
  async suggestGaps(request: GapAdvisorRequest, { signal }: GapCallOptions = {}): Promise<GapSuggestion[]> {
    signal?.throwIfAborted()
    const { wardrobe } = request
    const climates = climatesOf(request)
    const city = request.weather?.place.split(',')[0]
    const suits = (s: Staple) => !s.climate || !climates || climates.has(s.climate)
    const urgent = (s: Staple) => Boolean(s.climate && climates?.has(s.climate))

    const missing = STAPLES.filter((s) => suits(s) && !s.has(wardrobe))
    const emptyEssentials = ESSENTIAL.filter((c) => !wardrobe.some((i) => i.category === c))
    // An empty essential category first (its best staple for the climate), then climate needs, then the rest.
    const rank = (s: Staple) => {
      if (emptyEssentials.includes(s.category) && missing.find((m) => m.category === s.category) === s) return 0
      if (urgent(s)) return 1
      return 2
    }
    const ordered = missing.map((s, n) => ({ s, n })).sort((a, b) => rank(a.s) - rank(b.s) || a.n - b.n).map(({ s }) => s)

    return ordered.slice(0, LIMIT).map((s) => ({
      category: s.category,
      name: s.name,
      reason: urgent(s) && city ? `${s.reason} Made for days like today in ${city}.` : s.reason,
      colors: [...s.colors],
      pairsWithItemIds: pairsFor(s, wardrobe),
    }))
  }
}
