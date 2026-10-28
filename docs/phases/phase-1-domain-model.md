# Phase 1: Domain model

**Status:** Done
**Commit:** `9e99bf5`

## Goal
Define the model layer in `shared/`, test-first: schemas, contracts, pure utilities and seed data. It contains no framework code, so the Nuxt app now and the Nitro server later can both use it.

## What was built
### Models (zod schema + inferred type)
- **`shared/models/category.ts`:** seven closets in display order: tops, bottoms, dresses, outerwear, shoes, bags, accessories. Each has a label, a lucide icon and an order. Exports `CATEGORIES` and `getCategory()`.
- **`shared/models/item.ts`:**
  - `ItemDetailsSchema` holds what the user types: name, category, colours, brand, size, seasons, occasions, notes.
    - Names are trimmed and required.
    - Blank optional text is dropped rather than stored.
  - `ItemSchema` adds the id, `originalImage`, `cleanImage` (garment only, background removed), `isFavourite` and `createdAt`.
- **`shared/models/styleMatch.ts`:** a look. It has a title, `itemIds` (at least one), an optional `prompt`, an `explanation`, `isFavourite`, an optional `dailyPickDate` and `createdAt`.

### Contracts (`shared/contracts/`)
- **`WardrobeGateway.ts`:** everything the frontend needs from outside. It is split into `ItemGateway`, `PhotoGateway` (`removeBackground`) and `StyleMatchGateway`.
- **Server-side contracts for Phases 3–4:** `ItemRepository`, `StyleMatchRepository`, `ImageStore`, `ImageProcessor`, `StyleAdvisor` (`suggestLook({ wardrobe, prompt? })`).

### Utilities (`shared/utils/`)
- **`wardrobe.ts`:** `filterByCategory`, `countByCategory` (empty closets count as 0), `sortNewestFirst`.
- **`looks.ts`:** `recentLooks`, `favouriteLooks`, `todaysPick` and `resolveLookItems`.
  - `todaysPick` returns the explicit daily pick if there is one. Otherwise it picks a look from a hash of the date, so the choice stays the same all day.
  - `resolveLookItems` skips items that have been deleted.
- **`date.ts`:** `localIsoDate` (the local date, not UTC), `longDayLabel`, `shortDateLabel`.

### Seed data
- **`shared/fixtures/seed.ts`:** 33 items covering every category, and 6 looks, some of them favourites.
- **`scripts/generate-garments.mjs`:** generates placeholder garments as transparent SVG silhouettes in `public/garments/`. They stand in for background-removed photos.

### Contract test suite
- **`tests/contracts/wardrobeGateway.contract.ts`:** `wardrobeGatewayContract(name, make)`. Every gateway implementation must pass it. It checks that the gateway:
  - lists the seeded items and looks;
  - turns a photo into displayable images;
  - creates items with defaults;
  - rejects invalid details;
  - saves favourite toggles;
  - rejects unknown looks.

## Tests
- `tests/unit/models.test.ts`, `utils.test.ts`, `date.test.ts`, `seed.test.ts`. The seed test checks that the data is valid, that every closet has items, that every image exists, and that looks only reference seeded items.

## Key decisions
- **Images are stored as references (`string`) on the item, not as bytes.** The mock uses data URLs; the backend will use file references.
- **Two image fields from the start, `originalImage` and `cleanImage`.** The UI always shows the clean image.
- **The daily pick is deterministic.** A recommendation should not change between reloads.

## How to verify
```bash
npx vitest run --project unit
node scripts/generate-garments.mjs   # regenerates the placeholder images
```
