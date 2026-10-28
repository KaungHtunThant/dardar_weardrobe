// Draws the app icon (build/icon.png, 1024²): a rose Didone-style "D" on ivory with a gold hairline.
// Pure SVG paths, so it renders the same everywhere; electron-builder makes the .ico/.icns/Linux sizes from it.
import { mkdirSync } from 'node:fs'
import sharp from 'sharp'

const IVORY = '#fbf8f5'
const ROSE = '#b9787e'
const GOLD = '#c9a96e'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect x="32" y="32" width="960" height="960" rx="216" fill="${IVORY}"/>
  <circle cx="512" cy="512" r="380" fill="none" stroke="${GOLD}" stroke-width="5"/>
  <g fill="${ROSE}" transform="translate(-21 0)">
    <!-- stem with hairline serifs -->
    <rect x="370" y="300" width="52" height="424"/>
    <rect x="322" y="292" width="150" height="12"/>
    <rect x="322" y="720" width="150" height="12"/>
    <!-- bowl: hairline at top and bottom, heavy on the right -->
    <path fill-rule="evenodd" d="M422 292 H500 A244 220 0 0 1 500 732 H422 Z M422 304 H496 A190 208 0 0 1 496 720 H422 Z"/>
  </g>
</svg>`

mkdirSync('build', { recursive: true })
await sharp(Buffer.from(svg)).png().toFile('build/icon.png')
console.log('build/icon.png')
