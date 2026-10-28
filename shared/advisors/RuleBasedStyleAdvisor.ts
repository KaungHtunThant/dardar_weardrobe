import type { StyleAdvisor, StyleAdvisorRequest, StyleSuggestion } from '../contracts/StyleAdvisor'
import type { CategoryId } from '../models/category'
import { OCCASIONS, SEASONS, type Item, type Occasion, type Season } from '../models/item'
import type { StyleFix, StyleRating } from '../models/styleMatch'
import { ValidationError } from '../errors'

/**
 * The "Offline" advisor: deterministic, rule-based styling and a deliberately blunt rating.
 * Needs no network; the Claude CLI/API providers are the AI-backed alternatives.
 */

const NEUTRALS = new Set([
  'white', 'black', 'cream', 'ivory', 'grey', 'gray', 'navy', 'camel', 'beige', 'nude', 'tan', 'brown',
  'khaki', 'denim blue', 'light blue', 'denim', 'straw', 'gold', 'silver',
])

const FILL_ORDER: CategoryId[] = ['dresses', 'tops', 'bottoms', 'outerwear', 'shoes', 'bags', 'accessories']

const PROMPT_OCCASIONS: [RegExp, Occasion][] = [
  [/\b(work|office|meeting|interview)\b/, 'work'],
  [/\b(date|dinner|evening|night|glam\w*)\b/, 'evening'],
  [/\b(party|club|celebrat\w*)\b/, 'party'],
  [/\b(formal|wedding|gala|black tie)\b/, 'formal'],
  [/\b(gym|sport\w*|run|hike)\b/, 'sport'],
  [/\b(home|lounge|sofa|relax\w*)\b/, 'lounge'],
  [/\b(casual|brunch|weekend|errands|coffee|walk)\b/, 'casual'],
]

const PROMPT_SEASONS: [RegExp, Season[]][] = [
  [/\b(summer|beach|sunny|hot|holiday)\b/, ['summer']],
  [/\b(winter|snow|cold|freezing)\b/, ['winter']],
  [/\b(autumn|fall|cozy|cosy|chilly)\b/, ['autumn']],
  [/\b(spring|mild)\b/, ['spring']],
]

const DRESSY = /\b(dress|evening|party|glam\w*|formal|wedding|date)\b/

const OCCASION_TITLES: Record<Occasion, string> = {
  casual: 'Off-Duty',
  work: 'Office Edit',
  evening: 'Night Out',
  party: 'Party Mode',
  formal: 'Black Tie-ish',
  sport: 'Active Hours',
  lounge: 'Sunday Sofa',
}

const VERDICTS: [number, string][] = [
  [9, 'Annoyingly good. Wear it and say nothing.'],
  [7, "Solid — but you're playing it safe."],
  [5, 'Wearable. Forgettable.'],
  [3, 'This needs an intervention.'],
  [1, 'No. Absolutely not.'],
]

const isNeutral = (colour: string) => NEUTRALS.has(colour.toLowerCase())
const statementColours = (items: readonly Item[]) => [
  ...new Set(items.flatMap((i) => i.colors.map((c) => c.toLowerCase())).filter((c) => !isNeutral(c))),
]
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const names = (items: readonly Item[]) => {
  const list = items.map((i) => i.name)
  return list.length <= 1 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`
}

interface Context {
  occasions: Occasion[]
  seasons: Season[]
}

function promptContext(prompt = ''): Context {
  const text = prompt.toLowerCase()
  return {
    occasions: PROMPT_OCCASIONS.filter(([re]) => re.test(text)).map(([, o]) => o),
    seasons: [...new Set(PROMPT_SEASONS.filter(([re]) => re.test(text)).flatMap(([, s]) => s))],
  }
}

/** Occasions shared by the most pieces, in canonical order. */
function dominantOccasion(items: readonly Item[]): Occasion | null {
  let best: Occasion | null = null
  let bestCount = 0
  for (const occasion of OCCASIONS) {
    const count = items.filter((i) => i.occasions.includes(occasion)).length
    if (count > bestCount) [best, bestCount] = [occasion, count]
  }
  return best
}

function sharedSeasons(items: readonly Item[]): Season[] {
  if (items.length === 0) return []
  return SEASONS.filter((s) => items.every((i) => i.seasons.length === 0 || i.seasons.includes(s)))
}

function scoreCandidate(candidate: Item, look: readonly Item[], ctx: Context): number {
  let score = 0
  score += 3 * candidate.occasions.filter((o) => ctx.occasions.includes(o)).length
  score += 2 * candidate.seasons.filter((s) => ctx.seasons.includes(s)).length
  const palette = statementColours(look)
  const own = candidate.colors.map((c) => c.toLowerCase()).filter((c) => !isNeutral(c))
  if (own.length === 0) score += 2
  else if (own.every((c) => palette.includes(c))) score += 2
  else if (palette.length > 0) score -= 3
  return score
}

function bestPick(pool: readonly Item[], look: readonly Item[], ctx: Context): Item | undefined {
  return [...pool].sort((a, b) => scoreCandidate(b, look, ctx) - scoreCandidate(a, look, ctx) || a.id.localeCompare(b.id))[0]
}

export class RuleBasedStyleAdvisor implements StyleAdvisor {
  async suggestLook(request: StyleAdvisorRequest): Promise<StyleSuggestion> {
    const { wardrobe, prompt } = request
    const byId = new Map(wardrobe.map((i) => [i.id, i]))
    const pinned = request.pinnedItemIds.map((id) => {
      const item = byId.get(id)
      if (!item) throw new ValidationError(`Unknown piece: ${id}`)
      return item
    })

    const fromPrompt = promptContext(prompt)
    const pinnedOccasion = dominantOccasion(pinned)
    const ctx: Context = {
      occasions: fromPrompt.occasions.length ? fromPrompt.occasions : pinnedOccasion ? [pinnedOccasion] : ['casual'],
      seasons: fromPrompt.seasons.length ? fromPrompt.seasons : sharedSeasons(pinned),
    }

    const covered = new Set(pinned.map((i) => i.category))
    const fill = new Set(request.fillCategories)
    const separatesCovered = covered.has('tops') || covered.has('bottoms')
    const wantsDress =
      fill.has('dresses') &&
      !covered.has('dresses') &&
      !separatesCovered &&
      (DRESSY.test((prompt ?? '').toLowerCase()) || !(fill.has('tops') || fill.has('bottoms')))

    const look = [...pinned]
    const added: Item[] = []
    for (const category of FILL_ORDER) {
      if (!fill.has(category) || covered.has(category)) continue
      const hasDress = look.some((i) => i.category === 'dresses')
      if (category === 'dresses' && (!wantsDress || separatesCovered)) continue
      if ((category === 'tops' || category === 'bottoms') && hasDress) continue
      const pick = bestPick(
        wardrobe.filter((i) => i.category === category && !look.includes(i)),
        look,
        ctx,
      )
      if (!pick) continue
      look.push(pick)
      added.push(pick)
    }

    const occasion = ctx.occasions[0]!
    const palette = statementColours(look)
    return {
      title: `${palette[0] ? capitalise(palette[0]) : 'Quiet'} ${OCCASION_TITLES[occasion]}`,
      itemIds: look.map((i) => i.id),
      aiItemIds: added.map((i) => i.id),
      explanation: explain(pinned, added, occasion, prompt),
      rating: rate(look, wardrobe),
    }
  }
}

function explain(pinned: Item[], added: Item[], occasion: Occasion, prompt?: string): string {
  const brief = prompt ? ` Brief: “${prompt}”.` : ''
  if (pinned.length && added.length)
    return `Built around your ${names(pinned)}; the AI added the ${names(added)} for a ${occasion} look.${brief}`
  if (added.length) return `The AI put together the ${names(added)} for a ${occasion} look.${brief}`
  return `Rated exactly as you picked it: ${names(pinned)}.${brief}`
}

/** A blunt, rule-based critique. Base 6; earns points for discipline, loses them for confusion. */
export function rate(look: readonly Item[], wardrobe: readonly Item[]): StyleRating {
  const works: string[] = []
  const fails: string[] = []
  const fixes: StyleFix[] = []
  let score = 6

  const inLook = (i: Item) => look.includes(i)
  const has = (c: CategoryId) => look.some((i) => i.category === c)
  const occasion = dominantOccasion(look)
  const alternative = (to: Item, test: (i: Item) => boolean) =>
    wardrobe.filter((i) => i.category === to.category && !inLook(i) && test(i)).sort((a, b) => a.id.localeCompare(b.id))[0]

  if (look.length === 1) {
    score -= 2
    fails.push("One piece isn't a look; it's a garment.")
  }
  if (look.length > 6) {
    score -= 1
    fails.push('Seven-plus pieces. Edit before you leave the house.')
  }

  // Occasion: everything should agree on why you're dressed.
  const oddOnes = occasion && look.length > 1 ? look.filter((i) => !i.occasions.includes(occasion)) : []
  if (occasion && look.length > 1 && oddOnes.length === 0) {
    score += 1
    works.push(`Everything agrees on ${occasion}.`)
  } else if (occasion && oddOnes.length <= look.length / 2) {
    for (const odd of oddOnes.slice(0, 2)) {
      score -= 2
      fails.push(`The ${odd.name} is dressed for ${odd.occasions[0] ?? 'something else'}; the rest of the look is ${occasion}.`)
      const swap = alternative(odd, (i) => i.occasions.includes(occasion))
      fixes.push(
        swap
          ? { removeItemId: odd.id, addItemId: swap.id, note: `Swap the ${odd.name} for the ${swap.name}.` }
          : { removeItemId: odd.id, note: `Lose the ${odd.name}.` },
      )
    }
  }

  // Seasons: no wool-and-sandals energy.
  outer: for (const a of look) {
    for (const b of look) {
      if (a === b || !a.seasons.length || !b.seasons.length) continue
      if (!a.seasons.some((s) => b.seasons.includes(s))) {
        score -= 2
        fails.push(`The ${a.name} says ${a.seasons[0]}, the ${b.name} says ${b.seasons[0]}. Pick a season.`)
        break outer
      }
    }
  }

  // Colour: one hero, not a committee.
  const palette = statementColours(look)
  if (palette.length > 2) {
    score -= 2
    fails.push(`${palette.length} statement colours (${palette.join(', ')}) fighting for attention. Pick one hero.`)
    const loud = look.find((i) => i.colors.some((c) => c.toLowerCase() === palette.at(-1)))
    if (loud) {
      const calm = alternative(loud, (i) => i.colors.every(isNeutral))
      fixes.push(
        calm
          ? { removeItemId: loud.id, addItemId: calm.id, note: `Swap the ${loud.name} for the ${calm.name}.` }
          : { removeItemId: loud.id, note: `Lose the ${loud.name}.` },
      )
    }
  } else if (look.length > 1) {
    score += 1
    works.push(palette.length ? `Disciplined palette: ${palette.join(' and ')} with neutrals.` : 'All neutrals — calm and expensive-looking.')
  }

  // Silhouette: a dress or separates, then shoes.
  if (has('dresses') && (has('tops') || has('bottoms'))) {
    score -= 2
    fails.push('A dress plus separates. Pick a lane.')
  }
  const dressed = has('dresses') || (has('tops') && has('bottoms'))
  if (!has('shoes') && wardrobe.some((i) => i.category === 'shoes')) {
    score -= 1
    fails.push('No shoes. Bold choice, not a good one.')
    const shoes = wardrobe
      .filter((i) => i.category === 'shoes')
      .sort((a, b) => Number(occasion ? b.occasions.includes(occasion) : 0) - Number(occasion ? a.occasions.includes(occasion) : 0) || a.id.localeCompare(b.id))[0]!
    fixes.push({ addItemId: shoes.id, note: `Add the ${shoes.name}.` })
  } else if (dressed && has('shoes')) {
    score += 1
    works.push('Head-to-toe complete.')
  }
  const finisher = look.find((i) => i.category === 'bags' || i.category === 'accessories')
  if (finisher && fails.length < 2) works.push(`The ${finisher.name} finishes it.`)

  score = Math.min(10, Math.max(1, score))
  return {
    score,
    verdict: VERDICTS.find(([min]) => score >= min)![1],
    works: works.slice(0, 6),
    fails: fails.slice(0, 6),
    fixes: fixes.slice(0, 4),
  }
}
