# Architecture and conventions

## Layers (MVC)

```
shared/                 MODEL: framework-free domain code, imported by app/ and (later) server/
  models/               zod schemas + inferred types (Category, Item, StyleMatch)
  contracts/            interfaces (WardrobeGateway, repositories, ImageStore, ImageProcessor, StyleAdvisor)
  utils/                pure functions (filtering, counting, sorting, today's pick, dates)
  fixtures/seed.ts      prototype data

app/                    VIEW + client-side CONTROLLERS
  pages/ layouts/ components/   .vue files: template + styles only
  services/             one service per .vue file, mirroring the view tree; all view logic lives here
  stores/               Pinia stores: shared state + actions; the only callers of the gateway
  gateways/             WardrobeGateway implementations + composition root (createGateway.ts)
  plugins/gateway.ts    injects the configured gateway at startup

server/                 CONTROLLERS → services → repositories + infrastructure, wired in server/container.ts
  http/routes.ts        the whole API as one route table (Nitro: api/[...].ts; tests: in-process h3)
  database/             node:sqlite + Drizzle (sqlite-proxy), versioned migrations
electron/               desktop shell: main.ts (window, Nitro in production), preload.ts (minimal bridge)
tests/                  unit/, nuxt/, contracts/, e2e/
```

### How data flows

```
.vue view ──binds──▶ service (useXxx) ──calls──▶ Pinia store ──calls──▶ WardrobeGateway (interface)
                                                                          ├─ HttpWardrobeGateway (default) ─▶ /api ─▶ controllers ─▶ services ─▶ SQLite / image files
                                                                          └─ MockWardrobeGateway (dev:mock, tests)
```

- Views never touch stores, and stores never know which gateway they are using.
- `app/gateways/provider.ts` is the only link between stores and the gateway: `provideGateway()` / `useGateway()`.
- `app/gateways/createGateway.ts` is the only file that creates a concrete gateway. It picks one from `runtimeConfig.public.gateway`.
- AI styling sits behind `StyleAdvisor`. The mock gateway uses `MockStyleAdvisor` today, injected through its `advisor` option. In Phase 4 the server gets `ClaudeCliProvider` and `ClaudeApiProvider`; both pass the same advisor contract suite.

## Views are markup only

- A `.vue` file holds only `<template>` and `<style>`, plus a `<script setup>` limited to:
  - `defineProps` and `defineEmits`
  - `const vm = useXxx(props, emit)`
  - importing components and types
  - assigning a template ref that the service owns, e.g. `const emblaRef = vm.emblaRef`
- `ref`, `reactive`, `computed`, `watch`, `onMounted` and `use*Store` calls are forbidden in `.vue` files. `eslint.config.mjs` enforces this.
- Services live in `app/services/`, mirroring the view path:
  - `app/components/wardrobe/ClothesRail.vue` ↔ `app/services/components/wardrobe/ClothesRail.service.ts`
  - `app/pages/wardrobe/index.vue` ↔ `app/services/pages/wardrobe/index.service.ts`
- Services can't sit beside the `.vue` files: Nuxt would register a `.ts` file in `pages/` as a route, and one in `components/` as a component.
- A component with no script logic, such as `Hanger.vue` or `Chip.vue`, needs no service.
- Services import Vue, Pinia and Nuxt APIs explicitly (`from 'vue'`, `from '#imports'`), so they can be unit-tested without mounting.
- A service registers lifecycle hooks with `onViewMounted()` from `app/services/lifecycle.ts`. When the service runs outside a component, as in tests, the hook is skipped.

## SOLID in practice

| Principle | Where |
|---|---|
| Single responsibility | Views render, services handle view logic, stores hold shared state, gateways handle I/O. Snapshot storage is split out of the gateway (`SnapshotStore`). |
| Open/closed | New backends are new classes implementing a contract, for example `HttpWardrobeGateway` or `ClaudeCliProvider`. Existing code isn't edited. |
| Liskov | `tests/contracts/wardrobeGateway.contract.ts` runs the same behaviour suite against every gateway (memory-backed and IndexedDB-backed today). |
| Interface segregation | `WardrobeGateway` = `ItemGateway` + `PhotoGateway` + `StyleMatchGateway`; `ImageStore` is separate from `ItemRepository`. |
| Dependency inversion | Stores depend on the `WardrobeGateway` interface. Concrete classes are created only in `createGateway.ts`, and later in `server/container.ts`. |

## State in the URL

The Wardrobe page keeps its view state in the query string:
- `?view=list&filter=shoes`: the list view, filtered to one category.
- `?view=closet&closet=tops`: the closet view, with one closet open.

Links therefore work directly. Opening a closet pushes a history entry, so the Back button closes it.

## Design system

The tokens live in `app/assets/css/main.css`, in a Tailwind v4 `@theme` block.

- **Clothes images are the hero.** The UI stays quiet, girly, fashionable and simple.
- **Surfaces:** ivory `#FBF8F5`, cream `#F5EFEA`, white.
- **Text:** ink `#2E2A28`, with taupe `#8C817A` for secondary text.
- **Accent:** blush `#D8A7A7` / rose `#B9787E` only. It's used sparingly: the floating button, active chips, hearts, focus rings.
- **Gold** `#C9A96E` appears only in tiny details, such as closet handles and the rail.
- **Type:** Cormorant Garamond for display text and DM Sans for the UI, both self-hosted with `@nuxt/fonts`.
- **Garment images:** use the `.garment` utility, which adds a drop shadow and object-fit contain. Never put frames or overlays on garment images.
- **Motion:** gentle easing with `--ease-soft`. The closet doors are the one "delight" animation, and `prefers-reduced-motion` is respected.

## Testing conventions

| Suite | Location | Environment | Covers |
|---|---|---|---|
| unit | `tests/unit`, `tests/contracts` | node (+ fake-indexeddb) | models, utils, seed, gateway contract |
| nuxt | `tests/nuxt` | Nuxt + happy-dom | stores, services, page render tests |
| e2e | `tests/e2e` | Playwright `_electron` against `nuxt dev --port 3123` | full user flows in the real Electron window |

TDD order for each feature:
1. Service test.
2. Implement the service.
3. The `.vue` view.
4. Page render test.
5. Playwright flow.

### Gotchas
- **Nuxt component names come from the path prefix, and it is not deduplicated.**
  - `components/item/AddDialog.vue` becomes `<ItemAddDialog>`.
  - `item/AddItemDialog.vue` would become `<ItemAddItemDialog>`.
  - Page render tests fail on "Failed to resolve component".
- **Use `setupTestGateway()` from `tests/nuxt/helpers.ts` in nuxt tests.** It resets the Nuxt app's Pinia, which persists between tests, and injects an instant in-memory gateway.
- **Don't mock `useRouter`;** it breaks Nuxt's router hooks. Use the real router and `vi.spyOn` its methods.
- **`mountSuspended` navigates to `/` by default.** Pass `{ route: '/?view=list' }` to mount on a different route.
- **Node's `URL.createObjectURL` rejects happy-dom `File`s.** The add dialog guards it, and its tests stub it.
- **E2E fixtures call `POST /api/dev/reset` before each test,** so every test starts from the seed data. The e2e server runs with `NUXT_ALLOW_RESET=true` and a throwaway `.data-e2e`; a dev server on :3123 started without that flag makes the fixture fail loudly.
- **Server code imports from `h3` explicitly** (not Nitro auto-imports), so the unit tests can run it outside Nitro. Only `server/api/[...].ts` uses Nitro globals.
- **When stopping test servers,** use `pkill -f "[n]uxt dev --port 3123"`. A plain pattern also matches the shell running the command and kills it.
