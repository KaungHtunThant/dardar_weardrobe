# Phase 3: Backend (controllers and persistence)

**Status:** Done

## Goal
Replace the mock gateway with a real local backend. It is a Nitro server inside the Nuxt app, run by Electron in production, that stores data in SQLite and images on disk. The frontend changes in one place only, `app/gateways/createGateway.ts`. Every screen, including the Style Studio, then runs on real persistence.

## Decisions (adjusted from the original plan)
- **SQLite through `node:sqlite`,** which is built into Node 24 and into Electron's Node 24.22. Drizzle talks to it through its `sqlite-proxy` driver. There are **no native modules and no `electron-rebuild`**; this replaces better-sqlite3.
- **One route table** (`server/http/routes.ts`) serves:
  - Nitro, through a single catch-all `server/api/[...].ts`;
  - the tests, through a standalone h3 app.
  This way `HttpWardrobeGateway` can run the same `tests/contracts/wardrobeGateway.contract.ts` as the mock, in-process and without building Nuxt.
- **The rule-based advisor moves** to `shared/advisors/RuleBasedStyleAdvisor.ts`, so the server can use it. The Studio's Generate works on the backend from day one, and the advisor stays as the "offline" option in Phase 4.
- **Configuration** is Nuxt `runtimeConfig`, overridable with environment variables:
  - `NUXT_DATA_DIR` sets the data folder, holding `dardar.db` and `images/`. It defaults to `.data/` in dev; Electron sets it to `userData`.
  - `NUXT_DEMO_SEED` seeds the demo wardrobe into an empty database. It is on in dev and off in the packaged app.
  - `NUXT_ALLOW_RESET` enables `POST /api/dev/reset`, which only the e2e server turns on.
- **Gateway selection:** `runtimeConfig.public.gateway` defaults to `http`. `npm run dev:mock` (`NUXT_PUBLIC_GATEWAY=mock`) still runs the backend-free prototype.
- **Security:** the dev server binds to `127.0.0.1`, because the API has no authentication. Image ids are checked strictly against `uuid.ext`, so a request can't reach outside the image folder.

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

## What was built
- `server/database/`:
  - `schema.ts`: Drizzle tables.
  - `migrations.ts`: versioned through `PRAGMA user_version`.
  - `connection.ts`: `node:sqlite` exposed to Drizzle's sqlite-proxy, with WAL mode, auto-created folders and `clear()`.
- `server/repositories/SqliteItemRepository.ts`, `SqliteStyleMatchRepository.ts`. Null columns map back to absent optional fields.
- `server/infrastructure/FsImageStore.ts`: uuid file names, strict id check, immutable caching headers, and `pathOf()` for local tools.
- `server/infrastructure/PassThroughImageProcessor.ts`.
- `server/services/`:
  - `ItemService`
  - `PhotoService`: an image-only, 20 MB limit. If background removal fails it keeps the original, flagged with `backgroundRemoved: false`.
  - `StyleMatchService`
  - `StylingService`: validates the request and the picked pieces, resolves the advisor for each request, and saves the look.
  - `demoSeed`
  - `validation` (`parseOrThrow`)
- **Domain errors** (`shared/errors.ts`) map to 400 and 404 in `server/http/errors.ts`. Anything unexpected becomes a 500 with no details exposed.
- `server/controllers/*`, `server/http/routes.ts`, `server/api/[...].ts`, `server/bootstrap.ts`, `server/container.ts`.
- `app/gateways/HttpWardrobeGateway.ts`. It surfaces server messages, for example "There is nothing to style yet…".
- **Shared look-building:** `lookFromSuggestion()` refuses empty looks (a bug found while smoke-testing an empty production wardrobe).

## Tests
- Repository contracts run on in-memory SQLite.
- Server service tests run with temporary folders.
- **Gateway contract over HTTP:** `HttpWardrobeGateway` passes the same suite as the mock, against the real route table on an in-process h3 server (`tests/server/harness.ts`).
- API tests cover image serving, 400/404 mapping, the path-escape attempt, and the reset guard.
- **The 16 e2e flows now run against the real backend:** a throwaway `.data-e2e` folder, reset before each test.
- **Production smoke test:** with `NODE_ENV=production`, Electron starts the built Nitro server (on Electron's Node 24, `node:sqlite` included) on a random port, and the window loads from it with an empty wardrobe.

## Verification
- `npm test`, `npm run test:e2e`, `npm run lint` and `npm run typecheck` all pass. That's 190 unit and component tests and 16 e2e tests.
- `npm run build`, then launching Electron in production mode, serves the app from its own Nitro server.
