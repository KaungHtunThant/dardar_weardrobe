import type { Item, Occasion, Season } from '../models/item'
import type { CategoryId } from '../models/category'
import type { StyleMatch } from '../models/styleMatch'

// Prototype data. Images are placeholder silhouettes from scripts/generate-garments.mjs.

type Row = [slug: string, name: string, category: CategoryId, colors: string[], seasons: Season[], occasions: Occasion[], brand?: string]

const ROWS: Row[] = [
  ['linen-tee', 'White Linen Tee', 'tops', ['white'], ['spring', 'summer'], ['casual'], 'COS'],
  ['black-tee', 'Black Fitted Tee', 'tops', ['black'], ['spring', 'summer', 'autumn'], ['casual'], 'Uniqlo'],
  ['silk-blouse', 'Blush Silk Blouse', 'tops', ['blush'], ['spring', 'summer', 'autumn'], ['work', 'evening'], 'Reformation'],
  ['navy-shirt', 'Navy Button-Down', 'tops', ['navy'], ['spring', 'autumn'], ['work'], 'Massimo Dutti'],
  ['cream-knit', 'Cream Cable Knit', 'tops', ['cream'], ['autumn', 'winter'], ['casual', 'lounge'], '& Other Stories'],
  ['lavender-cardigan', 'Lavender Cardigan', 'tops', ['lavender'], ['spring', 'autumn'], ['casual', 'work']],
  ['sage-cami', 'Sage Satin Cami', 'tops', ['sage'], ['summer'], ['evening', 'party']],
  ['straight-jeans', 'Straight Blue Jeans', 'bottoms', ['denim blue'], ['spring', 'autumn', 'winter'], ['casual'], "Levi's"],
  ['black-trousers', 'Black Tailored Trousers', 'bottoms', ['black'], ['spring', 'autumn', 'winter'], ['work', 'formal'], 'Arket'],
  ['camel-trousers', 'Camel Wide-Leg Trousers', 'bottoms', ['camel'], ['autumn', 'winter'], ['work', 'casual']],
  ['pleated-skirt', 'Cream Pleated Midi Skirt', 'bottoms', ['cream'], ['spring', 'summer'], ['work', 'casual']],
  ['denim-shorts', 'Light Denim Shorts', 'bottoms', ['light blue'], ['summer'], ['casual']],
  ['burgundy-skirt', 'Burgundy A-Line Skirt', 'bottoms', ['burgundy'], ['autumn', 'winter'], ['evening', 'party']],
  ['little-black-dress', 'Little Black Dress', 'dresses', ['black'], ['spring', 'summer', 'autumn', 'winter'], ['evening', 'party', 'formal']],
  ['blush-midi-dress', 'Blush Midi Dress', 'dresses', ['blush'], ['spring', 'summer'], ['party', 'casual']],
  ['sage-slip-dress', 'Sage Slip Dress', 'dresses', ['sage'], ['spring', 'summer'], ['casual', 'evening']],
  ['red-evening-dress', 'Red Evening Dress', 'dresses', ['red'], ['autumn', 'winter'], ['formal', 'party']],
  ['white-sundress', 'White Sundress', 'dresses', ['white'], ['summer'], ['casual']],
  ['trench-coat', 'Camel Trench Coat', 'outerwear', ['camel'], ['spring', 'autumn'], ['casual', 'work'], 'Burberry'],
  ['leather-jacket', 'Black Leather Jacket', 'outerwear', ['black'], ['spring', 'autumn'], ['casual', 'evening'], 'AllSaints'],
  ['denim-jacket', 'Classic Denim Jacket', 'outerwear', ['denim blue'], ['spring', 'summer', 'autumn'], ['casual']],
  ['grey-wool-coat', 'Grey Wool Coat', 'outerwear', ['grey'], ['winter'], ['work', 'formal'], 'Max Mara'],
  ['white-sneakers', 'White Leather Sneakers', 'shoes', ['white'], ['spring', 'summer', 'autumn'], ['casual', 'sport'], 'Veja'],
  ['nude-heels', 'Nude Pumps', 'shoes', ['nude'], ['spring', 'summer', 'autumn', 'winter'], ['work', 'formal']],
  ['ankle-boots', 'Black Ankle Boots', 'shoes', ['black'], ['autumn', 'winter'], ['casual', 'work']],
  ['red-heels', 'Red Pumps', 'shoes', ['red'], ['spring', 'summer', 'autumn', 'winter'], ['evening', 'party']],
  ['black-handbag', 'Black Structured Handbag', 'bags', ['black'], ['spring', 'summer', 'autumn', 'winter'], ['work', 'formal']],
  ['camel-tote', 'Camel Leather Tote', 'bags', ['camel'], ['spring', 'autumn'], ['casual', 'work']],
  ['blush-mini-bag', 'Blush Mini Bag', 'bags', ['blush'], ['spring', 'summer'], ['party', 'evening']],
  ['gold-necklace', 'Gold Pendant Necklace', 'accessories', ['gold'], ['spring', 'summer', 'autumn', 'winter'], ['evening', 'work']],
  ['straw-hat', 'Straw Sun Hat', 'accessories', ['straw'], ['summer'], ['casual']],
  ['silk-scarf', 'Burgundy Silk Scarf', 'accessories', ['burgundy'], ['autumn', 'winter'], ['work', 'casual']],
  ['sunglasses', 'Classic Sunglasses', 'accessories', ['black'], ['spring', 'summer'], ['casual']],
]

const day = (n: number) => new Date(Date.UTC(2026, 8, 1 + n, 10)).toISOString()

export const seedItems: Item[] = ROWS.map(([slug, name, category, colors, seasons, occasions, brand], i) => ({
  id: `item-${slug}`,
  name,
  category,
  originalImage: `/garments/${slug}.svg`,
  cleanImage: `/garments/${slug}.svg`,
  colors,
  seasons,
  occasions,
  ...(brand ? { brand } : {}),
  isFavourite: false,
  createdAt: day(i),
}))

const ids = (...slugs: string[]) => slugs.map((s) => `item-${s}`)

export const seedStyleMatches: StyleMatch[] = [
  {
    id: 'look-parisian-weekend',
    title: 'Parisian Weekend',
    itemIds: ids('linen-tee', 'straight-jeans', 'trench-coat', 'white-sneakers', 'camel-tote'),
    explanation: 'Crisp white and camel over classic denim — effortless, polished, made for wandering.',
    isFavourite: true,
    createdAt: '2026-10-12T09:00:00.000Z',
  },
  {
    id: 'look-office-chic',
    title: 'Soft Power Office',
    itemIds: ids('silk-blouse', 'black-trousers', 'nude-heels', 'black-handbag', 'gold-necklace'),
    explanation: 'Blush silk softens sharp black tailoring; nude pumps lengthen the line.',
    isFavourite: true,
    createdAt: '2026-10-18T08:30:00.000Z',
  },
  {
    id: 'look-date-night',
    title: 'Date Night',
    itemIds: ids('little-black-dress', 'leather-jacket', 'red-heels', 'gold-necklace'),
    prompt: 'Something flirty but edgy for dinner',
    explanation: 'The LBD gets an edge from leather, and red pumps add the flirt.',
    isFavourite: false,
    createdAt: '2026-10-22T19:00:00.000Z',
  },
  {
    id: 'look-spring-brunch',
    title: 'Garden Brunch',
    itemIds: ids('sage-slip-dress', 'denim-jacket', 'white-sneakers', 'straw-hat'),
    explanation: 'Sage satin with washed denim — romantic but relaxed.',
    isFavourite: true,
    createdAt: '2026-10-24T10:00:00.000Z',
  },
  {
    id: 'look-cozy-autumn',
    title: 'Cozy Autumn Layers',
    itemIds: ids('cream-knit', 'camel-trousers', 'ankle-boots', 'grey-wool-coat', 'silk-scarf'),
    prompt: 'Warm and cozy for a chilly walk',
    explanation: 'Tonal creams and camels, with a burgundy scarf for a pop of warmth.',
    isFavourite: false,
    createdAt: '2026-10-26T15:00:00.000Z',
  },
  {
    id: 'look-summer-party',
    title: 'Summer Soirée',
    itemIds: ids('white-sundress', 'blush-mini-bag', 'sunglasses', 'straw-hat'),
    explanation: 'Airy white with blush accents — sweet, light and sunny.',
    isFavourite: false,
    createdAt: '2026-10-27T17:00:00.000Z',
  },
]
