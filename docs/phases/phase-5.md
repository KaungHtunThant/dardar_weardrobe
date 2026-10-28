# Phase 5: Manage pieces, Looks library, faster-feeling AI, installer

**Status:** In progress (Step 1 done)

The user chose all four next steps after Phase 4. The plan below is the approved one.

## Step 1: Edit and delete pieces (done)
- **Item detail sheet** (`app/components/item/DetailSheet.vue`, a right-side drawer built on `ui/Sheet.vue`). It opens from:
  - a list-view card,
  - a closet-rail garment,
  - the ⓘ on a Studio wardrobe-panel tile.

  The open piece lives in the URL (`?item=<id>`, `app/services/shared/itemSheetRoute.ts`), so Back closes the sheet.
- **View:** a large clean image, the facts (category, colours, brand, size, seasons, occasions, date added, notes) and "In N looks". The sheet loads the looks itself.
- **Edit:** the same fields as Add item. The form was extracted:
  - logic in `app/services/shared/itemForm.ts`;
  - markup in `app/components/item/DetailsForm.vue`;
  - both are now used by Add and Edit.
- **Replace photo:** the photo flow was extracted into `app/services/shared/photoUpload.ts` (pick or drop, background removal, preview), now shared with Add item. Confirming deletes the old stored files.
- **Delete** asks for confirmation and says how many looks will lose the piece. The piece is removed from every look (`withoutItem()` in `shared/utils/looks.ts` also drops its AI badge and any fix that mentions it). Looks left empty are deleted. Uploaded photos are deleted; demo `/garments/*` images never are.
- **API:**
  - `PATCH /api/items/:id`
  - `PUT /api/items/:id/photo`
  - `DELETE /api/items/:id`
  - `DELETE /api/looks/:id`
- **Contracts:** `ItemRepository.update/delete`, `StyleMatchRepository.delete`, `ImageStore.delete`, and the gateway's `updateItem / replaceItemPhoto / deleteItem / deleteLook` (implemented by both the mock and the HTTP gateway).
- **Tests:**
  - repository contracts;
  - the gateway contract (both gateways);
  - the API (photos 404 after a delete or replacement; demo images kept);
  - stores, the sheet and page services;
  - e2e (`manage-pieces.spec.ts`): edit moves the piece to its new closet; Back closes the sheet; delete from a closet removes it from looks and Home; the Studio ⓘ opens the sheet while tapping the tile still wears the piece.

## Step 2: Looks library (planned)
- A `/looks` page: filters (All, Favourites, Rated, Daily picks) and sorting (newest, highest score, lowest score).
- Card actions: favourite, Open in Studio (`/studio?look=<id>` loads the look and its verdict), Delete (with confirmation).

## Step 3: Faster-feeling AI (planned)
- An SSE endpoint `POST /api/looks/generate/stream` with stages and partial picks. The CLI uses stream-json with partial messages; the API uses `messages.stream`.
- Cancel aborts the SDK request or kills the CLI process; nothing is saved.

## Step 4: Installer (planned)
- electron-builder: AppImage built locally, and a Windows NSIS build on GitHub Actions. The Nitro output is shipped as `extraResources` outside the asar archive.
- An app icon, smoke-tested from a clean profile.
