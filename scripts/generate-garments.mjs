// Generates placeholder garment images (transparent SVG silhouettes) for the UI prototype.
// Real items will use background-removed photos; these only stand in for them.
// Usage: node scripts/generate-garments.mjs
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = new URL('../public/garments/', import.meta.url)

const shade = 'rgba(0,0,0,0.13)'
const light = 'rgba(255,255,255,0.35)'
const detail = (d, w = 2) => `<path d="${d}" fill="none" stroke="${shade}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`

/** Each shape: body path(s) filled with the garment colour + subtle detail lines. */
const SHAPES = {
  tshirt: (c) => `
    <path d="M62 30 L86 20 Q100 34 114 20 L138 30 L180 62 L162 92 L145 82 L145 222 L55 222 L55 82 L38 92 L20 62 Z" fill="${c}"/>
    ${detail('M86 20 Q100 40 114 20')}${detail('M55 82 L55 100 M145 82 L145 100', 1.5)}`,
  blouse: (c) => `
    <path d="M66 28 L88 18 Q100 30 112 18 L134 28 L158 48 L182 172 L162 178 L146 96 L148 222 L52 222 L54 96 L38 178 L18 172 L42 48 Z" fill="${c}"/>
    ${detail('M88 18 L100 44 L112 18')}${detail('M100 44 L100 222', 1.5)}
    <circle cx="100" cy="70" r="2.5" fill="${shade}"/><circle cx="100" cy="100" r="2.5" fill="${shade}"/><circle cx="100" cy="130" r="2.5" fill="${shade}"/>`,
  sweater: (c) => `
    <path d="M64 30 L88 20 Q100 30 112 20 L136 30 L160 52 L184 168 L162 176 L146 100 L148 214 L52 214 L54 100 L38 176 L16 168 L40 52 Z" fill="${c}"/>
    ${detail('M88 20 Q100 36 112 20', 3)}${detail('M52 204 L148 204', 3)}${detail('M18 160 L40 168 M182 160 L160 168', 3)}
    ${detail('M78 60 L78 200 M100 50 L100 200 M122 60 L122 200', 1)}`,
  cami: (c) => `
    <path d="M74 20 L80 20 L84 62 Q100 74 116 62 L120 20 L126 20 L132 72 Q152 92 150 124 L152 222 L48 222 L50 124 Q48 92 68 72 Z" fill="${c}"/>
    ${detail('M68 72 Q100 96 132 72')}<path d="M50 124 Q100 136 150 124" fill="none" stroke="${light}" stroke-width="2"/>`,
  trousers: (c) => `
    <path d="M56 18 L144 18 L150 40 L166 226 L122 226 L100 82 L78 226 L34 226 L50 40 Z" fill="${c}"/>
    ${detail('M56 34 L144 34', 2)}${detail('M100 34 L100 82', 1.5)}${detail('M72 50 L64 220 M128 50 L136 220', 1)}`,
  jeans: (c) => `
    <path d="M56 18 L144 18 L150 40 L164 226 L122 226 L100 84 L78 226 L36 226 L50 40 Z" fill="${c}"/>
    ${detail('M56 34 L144 34', 2)}${detail('M100 34 L100 84', 1.5)}${detail('M58 46 Q72 62 86 46 M114 46 Q128 62 142 46', 1.5)}
    <rect x="96" y="22" width="8" height="8" rx="2" fill="${light}"/>`,
  skirt: (c) => `
    <path d="M70 30 L130 30 L133 48 L172 212 Q100 228 28 212 L67 48 Z" fill="${c}"/>
    ${detail('M67 48 L133 48', 2)}${detail('M84 52 L66 216 M100 52 L100 220 M116 52 L134 216', 1)}`,
  shorts: (c) => `
    <path d="M54 50 L146 50 L151 70 L162 160 L114 166 L100 108 L86 166 L38 160 L49 70 Z" fill="${c}"/>
    ${detail('M54 66 L146 66', 2)}${detail('M100 66 L100 108', 1.5)}${detail('M40 150 L86 156 M114 156 L160 150', 1.5)}`,
  dress: (c) => `
    <path d="M78 16 L88 16 Q100 34 112 16 L122 16 L128 62 Q140 82 132 102 L176 226 Q100 240 24 226 L68 102 Q60 82 72 62 Z" fill="${c}"/>
    ${detail('M68 102 Q100 112 132 102', 2)}${detail('M86 110 L60 228 M114 110 L140 228', 1)}`,
  coat: (c) => `
    <path d="M70 18 L100 40 L130 18 L160 34 L180 184 L158 188 L148 100 L152 232 L48 232 L52 100 L42 188 L20 184 L40 34 Z" fill="${c}"/>
    ${detail('M70 18 L86 80 L100 40 L114 80 L130 18', 2)}${detail('M100 40 L100 232', 1.5)}${detail('M58 140 L142 140', 3)}
    <circle cx="92" cy="110" r="3" fill="${shade}"/><circle cx="108" cy="110" r="3" fill="${shade}"/><circle cx="92" cy="170" r="3" fill="${shade}"/><circle cx="108" cy="170" r="3" fill="${shade}"/>`,
  jacket: (c) => `
    <path d="M70 30 L100 50 L130 30 L160 44 L182 172 L160 176 L148 104 L150 196 L50 196 L52 104 L40 176 L18 172 L40 44 Z" fill="${c}"/>
    ${detail('M70 30 L84 86 L100 50 L116 86 L130 30', 2)}${detail('M100 50 L100 196', 1.5)}${detail('M52 182 L148 182', 2)}${detail('M64 120 L84 120 M116 120 L136 120', 1.5)}`,
  sneaker: (c) => `
    <path d="M18 168 Q16 128 46 120 L92 106 Q112 100 124 112 L152 132 Q186 138 186 160 L186 172 L18 172 Z" fill="${c}"/>
    <path d="M16 170 L188 170 L188 184 Q100 190 16 184 Z" fill="${shade}"/>
    ${detail('M70 118 L82 140 M84 112 L96 136 M98 108 L110 130', 2)}`,
  heel: (c) => `
    <path d="M24 126 Q60 116 102 138 L150 152 Q178 158 180 174 L180 180 L118 180 Q98 164 72 164 L62 206 L54 206 L50 160 Q34 152 24 140 Z" fill="${c}"/>
    ${detail('M30 132 Q60 128 96 146', 1.5)}`,
  boot: (c) => `
    <path d="M70 26 L122 26 L122 140 Q162 146 178 170 L178 192 L60 192 L64 120 Z" fill="${c}"/>
    <path d="M58 186 L180 186 L180 198 L58 198 Z" fill="${shade}"/>${detail('M70 40 L122 40', 2)}${detail('M112 50 L112 136', 1.5)}`,
  handbag: (c) => `
    <path d="M68 104 Q68 48 100 48 Q132 48 132 104" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round"/>
    <path d="M40 100 L160 100 L172 212 Q100 220 28 212 Z" fill="${c}"/>
    ${detail('M40 128 L160 128', 2)}<rect x="92" y="122" width="16" height="12" rx="3" fill="${light}"/>`,
  tote: (c) => `
    <path d="M66 96 L72 40 M90 96 L84 40 M110 96 L116 40 M134 96 L128 40" stroke="${c}" stroke-width="7" stroke-linecap="round"/>
    <path d="M72 40 L84 40 M116 40 L128 40" stroke="${c}" stroke-width="7" stroke-linecap="round"/>
    <path d="M36 94 L164 94 L156 222 L44 222 Z" fill="${c}"/>${detail('M36 110 L164 110', 1.5)}`,
  necklace: (c) => `
    <path d="M40 40 Q40 150 100 160 Q160 150 160 40" fill="none" stroke="${c}" stroke-width="4"/>
    <path d="M100 160 L88 182 L100 206 L112 182 Z" fill="${c}"/><circle cx="100" cy="183" r="5" fill="${light}"/>`,
  hat: (c) => `
    <path d="M16 156 Q100 186 184 156 Q178 142 140 136 Q140 76 100 74 Q60 76 60 136 Q22 142 16 156 Z" fill="${c}"/>
    <path d="M61 124 Q100 136 139 124 L140 136 Q100 148 60 136 Z" fill="${shade}"/>`,
  scarf: (c) => `
    <path d="M60 30 Q100 50 140 30 L150 60 Q100 84 50 60 Z" fill="${c}"/>
    <path d="M70 66 L92 70 L84 214 L60 210 Z M108 70 L130 66 L140 196 L116 200 Z" fill="${c}"/>
    ${detail('M62 204 L60 222 M70 206 L68 224 M78 208 L76 226 M118 196 L118 214 M126 196 L126 214 M134 194 L135 212', 1.5)}`,
  sunglasses: (c) => `
    <path d="M20 104 Q20 150 58 150 Q92 150 92 110 L92 98 L20 98 Z M108 98 L180 98 L180 104 Q180 150 142 150 Q108 150 108 110 Z" fill="${c}"/>
    <path d="M92 104 Q100 96 108 104" fill="none" stroke="${c}" stroke-width="5"/>
    <path d="M30 108 L50 108" stroke="${light}" stroke-width="4" stroke-linecap="round"/><path d="M118 108 L138 108" stroke="${light}" stroke-width="4" stroke-linecap="round"/>`,
}

/** [file id, shape, colour] — ids match shared/fixtures/seed.ts */
const GARMENTS = [
  ['linen-tee', 'tshirt', '#F4F1EC'],
  ['black-tee', 'tshirt', '#2B2B2E'],
  ['silk-blouse', 'blouse', '#E8B4B8'],
  ['navy-shirt', 'blouse', '#2F3A56'],
  ['cream-knit', 'sweater', '#EFE6D8'],
  ['lavender-cardigan', 'sweater', '#B8A9D9'],
  ['sage-cami', 'cami', '#A3B18A'],
  ['straight-jeans', 'jeans', '#5B7BA6'],
  ['black-trousers', 'trousers', '#2B2B2E'],
  ['camel-trousers', 'trousers', '#C19A6B'],
  ['pleated-skirt', 'skirt', '#EFE6D8'],
  ['denim-shorts', 'shorts', '#7C9CC4'],
  ['burgundy-skirt', 'skirt', '#7A2E3A'],
  ['little-black-dress', 'dress', '#2B2B2E'],
  ['blush-midi-dress', 'dress', '#E8B4B8'],
  ['sage-slip-dress', 'dress', '#A3B18A'],
  ['red-evening-dress', 'dress', '#B5373A'],
  ['white-sundress', 'dress', '#F4F1EC'],
  ['trench-coat', 'coat', '#C19A6B'],
  ['leather-jacket', 'jacket', '#2B2B2E'],
  ['denim-jacket', 'jacket', '#5B7BA6'],
  ['grey-wool-coat', 'coat', '#9A9A9E'],
  ['white-sneakers', 'sneaker', '#F4F1EC'],
  ['nude-heels', 'heel', '#E3C2A8'],
  ['ankle-boots', 'boot', '#2B2B2E'],
  ['red-heels', 'heel', '#B5373A'],
  ['black-handbag', 'handbag', '#2B2B2E'],
  ['camel-tote', 'tote', '#C19A6B'],
  ['blush-mini-bag', 'handbag', '#E8B4B8'],
  ['gold-necklace', 'necklace', '#C9A96E'],
  ['straw-hat', 'hat', '#D9C08F'],
  ['silk-scarf', 'scarf', '#7A2E3A'],
  ['sunglasses', 'sunglasses', '#2B2B2E'],
]

mkdirSync(OUT, { recursive: true })
for (const [id, shape, colour] of GARMENTS) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="400" height="480">${SHAPES[shape](colour)}</svg>\n`
  writeFileSync(new URL(`${id}.svg`, OUT), svg.replace(/\n\s+/g, ''))
}
console.log(`wrote ${GARMENTS.length} garments`)
