# Phase 3: Backend (controllers and persistence)

**Status:** Planned. It starts after the user signs off on the Phase 2 UI prototype.

## Goal
Replace the mock gateway with a real local backend. It is a Nitro server inside the Nuxt app, run by Electron in production, that stores data in SQLite and images on disk. The frontend changes in one place only: the gateway chosen in `app/gateways/createGateway.ts`.

## Scope
- **Persistence:**
  - Drizzle ORM + better-sqlite3.
  - The database sits in `DATA_DIR`, which is Electron `userData`; in dev it's a local `.data/` folder.
  - Schema and migrations for items and style matches.
- **Repositories:** `DrizzleItemRepository` and `DrizzleStyleMatchRepository`, implementing `shared/contracts/ItemRepository.ts` and `StyleMatchRepository.ts`.
- **Images:** `FsImageStore`, implementing `shared/contracts/ImageStore.ts`. Files go in `DATA_DIR/images`, and the store returns references the UI can display.
- **Server MVC:**
  - `server/services/`: business rules.
  - `server/controllers/`: map requests to services.
  - Thin `server/api/**` route files.
  - `server/container.ts`: the composition root.
- **API:** routes that mirror `WardrobeGateway`.
  - List and create items.
  - Upload a photo for background removal. The processor is a pass-through until Phase 4.
  - List style matches and toggle favourites.
- **Client:** `app/gateways/HttpWardrobeGateway.ts`, selected through `runtimeConfig.public.gateway = 'http'`.
- **Electron:** rebuild better-sqlite3 for the Electron runtime (`electron-builder install-app-deps`), and check the packaged AppImage starts its own Nitro server.

## Test plan (TDD)
- Repository contract suites run against in-memory SQLite.
- Route tests use `$fetch` from `@nuxt/test-utils`.
- `HttpWardrobeGateway` must pass `tests/contracts/wardrobeGateway.contract.ts`, the same suite the mock passes.
- The existing e2e flows must keep passing unchanged with the HTTP gateway.

## Verification
- `npm test` and `npm run test:e2e` pass with `gateway: 'http'`.
- Data survives an app restart: it's in the SQLite database, not in IndexedDB.
- `npm run build` produces a launchable AppImage.
