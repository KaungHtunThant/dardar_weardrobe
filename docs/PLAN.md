> **Status (2026-10-28):** Phases 0–2 are done, and the UI prototype is waiting for review. Phases 3–4 are planned.
> The per-phase write-ups are in [`phases/`](phases/), and the conventions are in [`architecture.md`](architecture.md).
>
> Changes from this plan made during implementation:
> - shadcn-nuxt was replaced by **reka-ui** used directly, with a few in-house primitives in `app/components/ui/`.
> - The add-item component is `app/components/item/AddDialog.vue`, because of Nuxt component naming.

# Dardar Wardrobe: tech stack and phased plan

## Context
This is a new, empty project at `/var/www/html/dardar_weardrobe`. It is a personal AI fashion advisor that works from the user's own clothes.

How it works:
1. **Add clothes.** The user uploads a photo of a garment. AI produces a clean image of the garment only, with the background removed. That image is saved to the database together with the details the user enters.
2. **Style match on demand.** AI combines the user's existing clothes into a look in the style the user wants, with or without a custom prompt. It explains the look.
3. The AI runs through a **CLI** (Claude Code `claude -p`) or the **API** (Anthropic SDK), whichever the user prefers.

Constraints from the user:
- Web-based desktop app: **Electron + Nuxt**.
- **Pinia** for state.
- **MVC** structure with **SOLID** principles.
- `.vue` files hold markup and design only; **each page and component has its own service file** with all of its logic.
- Test-driven.
- **Prototype first, frontend UI before any backend.**
- TypeScript everywhere.
- Single user, local-first.
- Claude first, behind a pluggable provider interface.

### Important technical note: background removal
Claude, through either the CLI or the API, can **understand** images but cannot **create or edit** them. The "clean garment image" step therefore needs its own `ImageProcessor` behind an interface. The recommendation:
- **Default:** `@imgly/background-removal-node`. It runs an ONNX model locally, offline and for free.
- **Optional, later:** an image-generation provider (OpenAI gpt-image or Gemini image editing) for a fully re-rendered "product shot".

Claude still does the vision work: it suggests the category, colors and tags to pre-fill the form, and it does all of the style matching. The prototype mocks this step, so the choice can wait until Phase 4.

## Tech stack
| Layer | Choice |
|---|---|
| Framework | **Nuxt 4** (`ssr: false`); Nitro server routes are the backend |
| Desktop shell | **Electron**. In dev it loads `nuxt dev`. In production the main process runs the built Nitro server (`.output/server/index.mjs`) with `utilityProcess.fork` on 127.0.0.1 at a free port. Packaged with electron-builder (AppImage) |
| State | **Pinia** (`@pinia/nuxt`) |
| UI | Tailwind CSS v4 + shadcn-nuxt (reka-ui) + `@nuxt/icon` (lucide); **embla-carousel-vue** (drag and swipe, `dragFree`) + wheel-gestures plugin for the closet rail; CSS 3D transforms for the closet door |
| Validation and types | zod in Nuxt 4 `shared/` (imported by both app and server) |
| Tests | Vitest + `@nuxt/test-utils` + @testing-library/vue; **Playwright** `_electron.launch()` for end-to-end tests |
| Persistence (later) | Drizzle ORM + better-sqlite3 plus an image folder in Electron `userData` |
| AI (later) | `ClaudeCliProvider` (`claude -p --output-format stream-json`), `ClaudeApiProvider` (`@anthropic-ai/sdk`, vision); `ImageProcessor` (imgly, local) |
| Quality | `@nuxt/eslint`, Prettier, `nuxi typecheck` |

## Visual design direction
The goal is **clothes first; the UI stays quiet, girly, fashionable and simple.** The interface works like a boutique backdrop: neutral and airy, with the color coming from the user's clothes.
- **Palette** (Tailwind v4 `@theme` tokens):
  - Background: warm ivory `#FBF8F5`.
  - Surfaces: white `#FFFFFF` and a soft cream `#F5EFEA`.
  - Text: warm charcoal `#2E2A28`, with taupe `#8C817A` for secondary text.
  - **One accent, dusty rose / blush** (`#D8A7A7`, deeper `#B9787E`), used sparingly: the floating button, the active category chip, the favourite heart, focus rings.
  - A hint of champagne gold `#C9A96E` only for small details such as closet door handles.
  - No colored blocks behind clothes.
- **Type:**
  - An elegant serif for page titles and look names: *Cormorant Garamond* or *Playfair Display*.
  - A clean sans for the UI: *DM Sans*.
  - Both are self-hosted through `@nuxt/fonts`, so the app works offline.
- **Clothes images are the hero:**
  - Transparent garment PNGs sit on plain ivory or white with a soft `drop-shadow`.
  - No borders, frames, overlays or gradients over the images.
  - Large thumbnails with generous whitespace.
  - Item text is small and placed below the image, never on top of it.
- **Shapes and motion:**
  - Soft rounded corners (`rounded-2xl`), hairline borders in blush or cream, very light shadows.
  - Gentle easing (200–600 ms).
  - The closet door animation is the one "delight" moment, and it respects `prefers-reduced-motion`.
- **Closet look:** pale cream doors with a thin blush outline and small gold handles. The interior is a soft-lit cream backdrop with a slim rail, and the garments hang on it. No wood textures or heavy illustrations.
- **Icons:** thin-stroke lucide icons only. No emoji or bright colors.
- **Light theme only** for the prototype. Tokens are kept in one place so a dark theme can be added later.

## MVC + SOLID structure
```
shared/                         # MODEL: domain, no framework code
  models/     item.ts category.ts styleMatch.ts            (zod schema + type)
  contracts/  WardrobeGateway.ts ItemRepository.ts StyleMatchRepository.ts
              ImageStore.ts ImageProcessor.ts StyleAdvisor.ts
  utils/      pure functions (filter by category, sort, today's pick…)
app/                            # VIEW + client controllers
  pages/        index.vue  wardrobe/index.vue               (.vue: template and styles only)
  components/   home/  wardrobe/  item/  ui/                 (.vue: template and styles only)
  services/     mirrors the view tree, one per .vue file:
    pages/index.service.ts                    → useHomePage()
    pages/wardrobe/index.service.ts           → useWardrobePage()
    components/wardrobe/ClothesRail.service.ts → useClothesRail(props, emit)
  stores/       wardrobe.ts  styleMatches.ts  ui.ts         (Pinia)
  gateways/     MockWardrobeGateway.ts  (later HttpWardrobeGateway.ts)
  plugins/      gateway.ts  (injects the gateway: DIP)
server/                         # CONTROLLER + model infrastructure (Phase 3+)
  api/** → controllers/ → services/ → repositories/ + infrastructure/{db,images,ai}
  container.ts  composition root
electron/  main.ts preload.ts
tests/     unit/ component/ e2e/ contracts/
```
**View and service rule:**
- A `.vue` `<script setup>` contains only `defineProps`/`defineEmits` and `const vm = useXxx(props, emit)`.
- All refs, computed values, watchers, handlers and store calls live in the service.
- Services sit in `app/services/` rather than beside the `.vue` files, because Nuxt would turn `.ts` files in `pages/` into routes and `.ts` files in `components/` into components.
- An ESLint rule in `.vue` files flags `ref`, `computed`, `watch` and `use*Store`.

**SOLID:**
- **S:** each layer has one job. Controllers map requests, services hold rules, repositories persist.
- **O and L:** new implementations (gateway, AI provider, image processor) are added as new classes. One shared contract test suite runs against every implementation.
- **I:** small contracts, for example `ImageStore` separate from `ItemRepository`.
- **D:** stores depend on `WardrobeGateway`, and services depend on interfaces. Wiring happens in `plugins/gateway.ts` and `server/container.ts`.

## Domain models
- `Item`:
  - id, name, category
  - `originalImage` and `cleanImage`
  - colors, brand, size, season, occasion, notes (the details the user adds)
  - favourite, createdAt
- `Category`: tops, bottoms, dresses, outerwear, shoes, bags, accessories. Each has an icon and a sort order.
- `StyleMatch`: id, title or style name, itemIds, optional prompt, explanation, `isFavourite` (this is what "favourite looks" means), `isDailyPick` with a date, createdAt.

## Phases (each step: write a failing test, make it pass, refactor)

### Phase 0: Scaffolding
- `git init` and Nuxt 4 init.
- Add the Pinia, Tailwind, shadcn-nuxt, icon, eslint and test-utils modules, plus Embla, Vitest, Playwright and Electron (dev runner plus main and preload built with esbuild).
- Scripts: `dev`, `dev:web`, `test`, `test:e2e`, `typecheck`, `lint`, `build`.
- `CLAUDE.md` with the TDD, UI-first, MVC, view/service and SOLID rules.
- Set Serena `language_servers: [typescript, vue]`, then re-index jcodemunch and codebase-memory.
- Check that the Electron window opens under WSLg.

### Phase 1: Model (`shared/`)
- zod schemas, contracts and pure utils, all test-first.
- Seed fixtures: about 30 items across categories, using placeholder transparent-PNG garment images, plus a few style matches.

### Phase 2: Frontend UI prototype (mock gateway, no backend)
`MockWardrobeGateway` keeps data in memory and in IndexedDB. Its add-item step simulates a "processing" delay and returns the uploaded image as the "clean" image. For each piece below, the service test comes first, then the render test, then the Playwright flow.

1. **Design tokens and app shell**: theme tokens, fonts and base UI primitives (Button, Chip, Card, FAB, Dialog styled to the direction above); a desktop layout with slim, minimal navigation (Home, Wardrobe).
2. **Home page** (`pages/index.vue`):
   - **Today's recommendation**: a hero card showing the look's items together, its style name and a short explanation.
   - **Recent style matches**: a horizontal row of look cards, newest first.
   - **Favourite looks**: a grid of looks marked as favourites, with a toggle to favourite or unfavourite.
   - An empty state for each section.
3. **Wardrobe page** (`pages/wardrobe/index.vue`) with a **List view and Closet view toggle**. The view, and the open closet, are kept in the route query (`?view=closet&category=tops`) so the Back button closes the closet.
   - **Closet view**:
     - A grid of **categorized closets**, each showing the category name, an icon and the item count.
     - Clicking a closet plays a **door-opening animation**: two door panels rotate out with `rotateY` and `perspective`, and the interior fades in.
     - Inside, that category's clothes **hang in a line on a rail**. The rail scrolls horizontally by **swipe, drag or mouse wheel** (Embla `dragFree` plus wheel-gestures).
     - The page has **no vertical scrolling** (`h-dvh overflow-hidden`).
     - A close or back control shuts the doors with the reverse animation.
   - **List view**:
     - **Category selector at the top** (sticky chips or tabs, including "All").
     - Items appear as cards or rows below it, and the page **scrolls vertically**.
   - **Floating "Add item" button** at the bottom right, in both views.
4. **Add-item flow** (opened by the floating button):
   - A dialog: drop or pick a photo.
   - A mock "Removing background…" state.
   - A preview of the clean image.
   - A details form (name, category, colors, brand, size, season, occasion, notes) validated by zod.
   - Save. The new item appears in the list and in the matching closet.

**Stop for user review in Electron** before going further. The style-match request screen (an optional prompt that generates a look) is the next prototype step once this review is done.

### Phase 3: Controllers + persistence
- Drizzle schema and migrations, repositories (in-memory SQLite, contract suite), `FsImageStore`, services, controllers and thin `server/api` routes.
- `HttpWardrobeGateway` takes the mock's place through runtimeConfig.
- better-sqlite3 rebuilt for Electron.

### Phase 4: AI
- `ImageProcessor`: imgly local background removal, with an optional image-generation provider later.
- `StyleAdvisor` contract with two providers:
  - `ClaudeCliProvider`: `claude -p` with item metadata and clean-image paths.
  - `ClaudeApiProvider`: SDK with vision.
- Both return a `StyleMatch` as structured JSON validated by zod.
- Contract tests run against a fake process and a mocked SDK.
- Settings to choose CLI or API, choose the model (default: latest Claude), and store the API key with Electron `safeStorage`.
- Daily-pick generation and vision-based pre-fill of the add-item form.

## Verification
- `npm test` and `npm run typecheck` pass after every step.
- `npm run test:e2e` covers:
  - The home sections rendering.
  - Switching between list and closet views.
  - Opening a closet and dragging the rail, with the page's vertical scroll position staying at 0.
  - Filtering by category in the list view.
  - Adding an item through the floating button and seeing it in both views.
- `npm run dev`: manual UI review in the Electron window at the end of Phase 2.
- Phase 4: live smoke tests of the CLI (`~/.local/bin/claude`) and API providers, and of background removal on real photos.
