# Phase 3: Backend (controllers and persistence)

**Status:** In progress

## Goal
Replace the mock gateway with a real local backend. It is a Nitro server inside the Nuxt app, run by Electron in production, that stores data in SQLite and images on disk. The frontend changes in one place only, `app/gateways/createGateway.ts`. Every screen, including the Style Studio, then runs on real persistence.

## Decisions (adjusted from the original plan)
- **SQLite through `node:sqlite`,** which is built into Node 24 and into Electron's Node 24.22. Drizzle talks to it through its `sqlite-proxy` driver. There are **no native modules and no `electron-rebuild`**; this replaces better-sqlite3.
- **One route table** (`server/http/routes.ts`) serves:
  - Nitro, through a single catch-all `server/api/[...].ts`;
  - the tests, through a standalone h3 app.
  This way `HttpWardrobeGateway` can run the same `tests/contracts/wardrobeGateway.contract.ts` as the mock, in-process and without building Nuxt.
- **The rule-based advisor moves** to `shared/advisors/RuleBasedStyleAdvisor.ts`, so the server can use it. The Studio's Generate works on the backend from day one, and the advisor stays as the "offline" option in Phase 4.
- **Data directory:** `DATA_DIR`, which Electron sets to `userData`; in dev it defaults to `.data/`. It holds `dardar.db` and `images/`.
- **Demo data:** `DARDAR_DEMO_SEED=1` (on for dev and e2e) seeds the demo wardrobe into an empty database. The packaged app starts empty.
- **Test reset:** `POST /api/dev/reset` exists only when `DARDAR_ALLOW_RESET=1`. The e2e tests use it to start each test from seed data.
- **Gateway selection:** `runtimeConfig.public.gateway` defaults to `http`. `NUXT_PUBLIC_GATEWAY=mock npm run dev:web` still runs the backend-free prototype.

## Server layout (MVC + SOLID)
```
server/
  database/   schema.ts (Drizzle tables), connection.ts (node:sqlite ↔ sqlite-proxy), migrations.ts
  repositories/  SqliteItemRepository, SqliteStyleMatchRepository   (shared/contracts/*Repository)
  infrastructure/ FsImageStore (shared/contracts/ImageStore), PassThroughImageProcessor (until Phase 4)
  services/   ItemService, PhotoService, StyleMatchService, StylingService   (business rules)
  controllers/ ItemController, PhotoController, LookController, ImageController (HTTP ↔ service)
  http/       routes.ts (route table + router), errors.ts (zod/not-found → HTTP errors)
  api/[...].ts  Nitro entry → router
  container.ts  composition root (the only place concrete classes are built)
```

## API
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/items` | List items |
| POST | `/api/items` | Create an item (details + image refs) |
| POST | `/api/photos` | Multipart upload. Saves the original, removes the background, saves the clean image, returns both refs |
| GET | `/api/images/:id` | Serve a stored image |
| GET | `/api/looks` | List style matches |
| PUT | `/api/looks/:id/favourite` | Set `isFavourite` |
| POST | `/api/looks/generate` | Studio: complete and rate a look, and save it |
| POST | `/api/dev/reset` | Test-only reset to the seed data |

## Test plan (TDD)
- Repository contract suites run against in-memory SQLite.
- Service unit tests use fakes.
- `HttpWardrobeGateway` must pass the shared gateway contract, against an in-process h3 server built from the same route table.
- The e2e suite runs unchanged on the HTTP gateway, with a temporary `DATA_DIR` and reset between tests.

## Verification
- `npm test` and `npm run test:e2e` pass with `gateway: 'http'`.
- Data survives an app restart: it lives in SQLite and on disk, not in IndexedDB.
- `npm run build` produces a Nitro server that Electron starts in production.
