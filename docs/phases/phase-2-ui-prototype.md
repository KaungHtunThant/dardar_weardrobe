# Phase 2: Frontend UI prototype

**Status:** Done, awaiting the user's review before Phase 3
**Commits:**
- `1e0c0a4`: part 1, mock gateway, stores, shell and Home
- `a9fe6aa`: part 2, Wardrobe closet and list views
- `745e576`: part 3, add-item flow
- `079603e`: part 4a, style requests, ratings and the mock advisor
- part 4b (this commit): the Style Studio page

## Goal
Build the whole UI as a working prototype with no backend, so the experience can be reviewed early. Data comes from a mock gateway that saves to IndexedDB.

## What was built

### Data layer (client)
- **`app/gateways/MockWardrobeGateway.ts`:** implements `WardrobeGateway`.
  - Seeds itself on first run.
  - Simulates latency, 250 ms by default (5× that for background removal), so loading states are visible.
  - `removeBackground` returns the photo unchanged, as a data URL.
  - The clock and id generator are injectable for tests.
- **`app/gateways/persistence/`:** the `SnapshotStore` interface with `InMemorySnapshotStore` (tests) and `IndexedDbSnapshotStore` (the app, database `dardar-wardrobe`).
- **`app/gateways/provider.ts`, `createGateway.ts`, `app/plugins/gateway.ts`:** the client composition root.
- **`app/stores/wardrobe.ts`:** items newest first, per-category counts, `byCategory()`, `load()` (runs once), `prepareImage()`, `addItem()`.
- **`app/stores/styleMatches.ts`:** `recent(n)`, `favourites`, `pickFor(date)`, `toggleFavourite()`. The toggle updates the screen immediately and rolls back if saving fails.

### Shell
- **`app/layouts/default.vue`:** a slim top bar with the "Dardar wardrobe" wordmark and Home / Wardrobe links; the active link gets a blush underline. The `<main id="main">` element is the scroll container.
- **UI primitives in `app/components/ui/`:** `Chip`, `Dialog` (built on reka-ui), `EmptyState`, `Fab`, `HeartButton`, `SectionHeader`, `Segmented`.

### Home (`app/pages/index.vue`)
- **Today's recommendation:** `home/TodayHero.vue`. A large serif look title, the date, the explanation, the custom prompt if there was one, a heart, and a flat-lay collage of the look's clothes.
- **Recently styled:** a horizontal row of `home/LookCard.vue` cards, newest first.
- **Favourite looks:** a grid of the looks marked with a heart.
- **Collage layout:** `home/LookCollage.vue` and its service. The main garment comes first (dress, then top, then outerwear) in a wider left column, with up to 5 pieces in total.
- Each section has an empty state.

### Wardrobe (`app/pages/wardrobe/index.vue`)
- **Closet view (the default):**
  - **The wall:** `wardrobe/ClosetTile.vue` shows the seven categories side by side as tall cream closets with gold handles and a brass name plaque. The doors fall slightly ajar on hover, giving a glimpse of what's inside.
  - **Opening a closet:** `wardrobe/ClosetStage.vue` and `wardrobe/ClosetDoors.vue`. The doors swing open with a 3D rotation over 850 ms, and the interior fades in. Escape, "All closets" or the Back button closes them.
  - **Inside:** `wardrobe/ClothesRail.vue`. Garments hang on hangers (`Hanger.vue`) from a gold rail; shoes, bags and accessories sit on a shelf. Embla Carousel scrolls the rail sideways by drag or swipe (`dragFree`), the mouse wheel (wheel-gestures plugin), arrow buttons or arrow keys. The page has **no vertical scrolling**.
- **List view:**
  - `wardrobe/CategoryBar.vue`: sticky category chips with counts, including "All".
  - Below them, a grid of `wardrobe/ItemCard.vue` that scrolls vertically.
- **Floating "Add item" button** (`ui/Fab.vue`) in both views.
- View state lives in the URL (see `architecture.md`).

### Add item (`app/components/item/AddDialog.vue`)
1. **Pick:** drop a photo or browse for one. Files that aren't images are rejected.
2. **Processing:** the user's photo is shown under a shimmer with "Removing background…".
3. **Details:** the clean image is previewed next to a form validated by zod. It has the name, category chips (pre-selected from the open closet or the list filter), colours (comma-separated), brand, size, season and occasion chips, and notes. Each field shows its own error.
4. **Save:** the item appears at the top of the list and of its closet, and survives a reload.

### Style Studio (`app/pages/studio.vue`), added at the user's request
On one page the user mixes their own picks with AI picks, and gets a brutally honest rating.
1. **Pick your pieces (optional):** `studio/PiecePicker.vue`. Category tabs show how many pieces have been picked in each; tap a piece to pick or unpick it.
2. **Let the AI fill:** `studio/FillToggles.vue`. One toggle per category; the defaults are tops, bottoms, shoes and bags. A category you already picked from shows "yours" and is locked.
3. **Describe the vibe (optional):** a free-text prompt.
4. **Your look:** `studio/LookBoard.vue`. Your picks, plus a dashed "AI picks …" placeholder for each category the AI will fill.
5. **Generate & rate:** shows "Styling… and judging", then the result:
   - `studio/ResultLook.vue`: the completed look, with an "AI pick" badge on each piece the AI chose.
   - `studio/RatingCard.vue`: the score out of 10, a blunt verdict, what works, what doesn't, and fixes that use the user's own clothes. "Try it" applies a fix and the look is re-rated in place.
6. The look is saved as a style match with its rating, so it appears in Home's "Recently styled" with its score. "Tweak picks" keeps your selections; "Start fresh" clears them.

Domain additions:
- **`shared/models/styleRequest.ts`:** picked piece ids, the categories open to the AI, and an optional prompt. At least one pick or one category is required.
- **`shared/models/styleMatch.ts`:** gains `rating` (`StyleRatingSchema`) and `aiItemIds`.
- **`shared/contracts/StyleAdvisor.ts`:** `suggestLook({ wardrobe, pinnedItemIds, fillCategories, prompt? })`.
- **`WardrobeGateway`:** gains `StylingGateway.generateLook()`.

**`app/gateways/mock/MockStyleAdvisor.ts`:** a deterministic, rule-based stand-in for Claude.
- It fills gaps by scoring candidates on occasion (from the prompt or your picks), season and colour harmony.
- It never pairs its own dress with separates.
- It rates from a base of 6:
  - **Up** for a single shared occasion, a disciplined palette, and a complete outfit.
  - **Down** for pieces dressed for different occasions, clashing seasons, three or more statement colours, a dress worn with separates, missing shoes, or a single piece.
- Each problem comes with a fix from the user's wardrobe where possible.

## Tests
- **Advisor contract:** `tests/contracts/styleAdvisor.contract.ts`. Every advisor, including the future Claude CLI and API providers, must pass it. It checks that the advisor:
  - keeps the picked pieces;
  - adds at most one piece per open category;
  - doesn't fill a category the user picked from;
  - never pairs its own dress with separates;
  - can build a whole look or simply rate one;
  - only suggests fixes that use real wardrobe pieces.
- **Contract:** the mock gateway passes the shared suite with both the memory and the IndexedDB stores, plus persistence, data-URL and clock tests.
- **Nuxt (`tests/nuxt/`):**
  - The stores.
  - Every service (layout, Home, collage, look card, Wardrobe page, category bar, closet stage, clothes rail, item card, add dialog).
  - Page render tests for Home and Wardrobe. These fail if any component doesn't resolve.
- **E2E (`tests/e2e/`), 10 flows in real Electron:**
  - `home.spec.ts`: the Home sections, and favouriting a look.
  - `wardrobe.spec.ts`:
    - the wall of 7 closets with no vertical scroll;
    - the doors opening;
    - drag and mouse wheel moving the rail sideways while the page's scroll position stays at 0;
    - "All closets" and Back both closing the closet;
    - the list filter and vertical scrolling;
    - the floating button present in both views.
  - `add-item.spec.ts`: adding an item from the list view (it then appears in the list and in its closet), and an added item surviving a reload.
  - `studio.spec.ts`:
    - mixing your picks with AI picks, getting a rating, applying a fix (the look is re-rated), and seeing it on Home;
    - an all-AI look;
    - Generate disabled when there is nothing to do.
- **Totals:** 137 unit and component tests and 13 e2e tests, all passing; lint and typecheck clean.

## Key decisions
- **Background removal is simulated.** Claude cannot edit images; real removal is Phase 4.
- **reka-ui is used directly instead of shadcn-nuxt.** Only a handful of primitives were needed, styled to the design direction.
- **Services sit in a mirrored folder, `app/services/`.** Nuxt would otherwise auto-register `.ts` files as routes or components.
- **The add component is named `item/AddDialog.vue`,** because of Nuxt's path-prefix naming.
- **The closet wall is a single row of seven tall closets.** It fits a 1360×880 window without scrolling and feels like a walk-in closet.

## How to verify
```bash
npm test
npm run test:e2e
npm run dev        # manual review in the Electron window
```

## Next
- The user reviews the prototype, including the Style Studio.
- Then Phase 3 (backend). In Phase 4 the Claude providers replace `MockStyleAdvisor`, behind the same contract.
