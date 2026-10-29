# Phase 8: What your wardrobe is missing

**Status:** Done

The user asked for a new Home section with suggestions for the pieces the wardrobe is missing.

## How it works
- **Who finds the gaps:** the stylist the user chose, using the same pattern as styling.
  - Claude CLI or API, running as Dardar. The persona has a new playbook, *find what the wardrobe is missing*, so `STYLIST_AGENT_VERSION` is now 3.
  - The **offline rules**: a capsule-wardrobe checklist.
  - If Claude fails, the offline rules answer and the report says `by: 'offline'`.
- **What a suggestion is** (`shared/models/gap.ts`):
  - `GapSuggestion { category, name, reason, colors, pairsWithItemIds }`: a short shoppable name, one or two blunt sentences on why, and up to four pieces **already owned** that it would be worn with.
  - `GapReport { gaps (≤ 6), wardrobeKey, place, by, createdAt }`.
- **When it is written:** the report is kept until the **wardrobe** (`wardrobeKey()`, from the piece ids) or the **city** changes, or the user taps *Ask Dardar again*. So Claude is asked once per change, not on every visit. An empty wardrobe has no report.
- **Climate:** the stylist gets today's forecast for the user's city (Phase 7). The offline rules move climate staples up (a wool coat, boots or a jumper when it's cold; sandals when it's hot; a trench when it's wet), drop ones that don't suit, and add "Made for days like today in Oslo."

## The offline rules (`shared/advisors/RuleBasedGapAdvisor.ts`)
- 16 staples across every category, each with a test for whether the wardrobe already has it (by name, colour, category, season or occasion). Examples: white tee, white shirt, jumper, jeans, tailored trousers, LBD, wool coat, blazer, trench, trainers, boots, sandals, pumps, tote, clutch, belt.
- The order:
  1. An **empty essential category** (tops, bottoms, outerwear, shoes or bags) gets its best staple first.
  2. Then staples urgent for the climate.
  3. Then the rest, in checklist order. At most 5.
- "Wear it with": up to three owned pieces from other categories, one per category, that share an occasion. Pieces in a matching season and neutrals come first.
- On the demo wardrobe it suggests a crisp white shirt, a tailored blazer and a black leather belt, plus flat sandals when the climate is warm or unknown.

## Server
- **Contract** `GapAdvisor.suggestGaps({ wardrobe, weather }, { signal })`. The suite is `tests/contracts/gapAdvisor.contract.ts`, and the offline rules and both Claude providers (fake process, fake client) pass it. It checks:
  - valid, distinct suggestions that pair only with real pieces;
  - a missing essential first;
  - basics for an empty wardrobe;
  - cancelling.
- **Claude:**
  - `server/ai/gapPrompt.ts` builds the message (the task, the city and today's weather, the wardrobe as JSON in the same shape as styling via `modelWardrobe()`).
  - `toGapSuggestions()` always normalises the output: trims, de-duplicates names, drops unknown piece ids, keeps 3 colours and 5 suggestions at most.
  - `ClaudeCliGapAdvisor` and `ClaudeApiGapAdvisor` (structured output; a refusal throws).
- **`SettingsService.resolveGapAdvisor()`** picks CLI, API or offline, like the other resolvers.
- **`GapService`:**
  - `current()` keeps or rewrites the report; `refresh()` always asks.
  - Callers asking at once share one request. A refresh joins a refresh already in flight, or waits for a check before asking.
  - The report is saved by `SqliteGapReportRepository`: migration 4, a one-row `gap_reports` table, emptied by *Start fresh* and by reset. It passes the new repository contract.
- **API:** `GET /api/wardrobe/gaps` → `{ report }`, `POST /api/wardrobe/gaps/refresh` → `{ report }`.

## Client
- **Gateway:** `GapGateway` (`getWardrobeGaps`, `refreshWardrobeGaps`), implemented by HTTP and the mock (offline rules, in memory). Both pass the gateway contract: kept, rewritten after a move or a deletion, and gone after *Start fresh*.
- **`gaps` store:** `load`, `refresh` and `forget`. A failure keeps the last report.
- **Home:**
  - A *Wardrobe gaps · What your wardrobe is missing* section between *Recently styled* and *Favourite looks*. It appears only once the wardrobe has pieces.
  - Each piece is a cream card: the category icon, the category and colours, the name in Cormorant, the reason, and *Wear it with* with the owned garments as `.garment` thumbnails (no frames).
  - *Ask Dardar again* asks the stylist again. The section shows "Dardar is going through your wardrobe…" while it waits, or "Nothing essential is missing" when nothing is.
  - It loads alongside today's look. Saving the city in the welcome reloads both.

## Found on the way
The first screenshot suggested sandals to a user who had just said they live in Paris on a cool day. The report had been written before the welcome saved the city, and only a wardrobe change made it stale. The report now records its city (`place`), and a move makes it stale. There are tests in `tests/server/gaps.test.ts`, the gateway contract and the Home service.

## Verification
- `npm test`: 638 passed (15 opt-in skipped); lint and typecheck clean.
- `npm run test:e2e`: 28 passed, including *home lists what the wardrobe is missing and can ask again*.
- Screenshot of the section checked by eye.
- Not run: the live Claude call for the new task (it costs money). The prompt, the normaliser and both providers are covered with fakes.

## Known limits
- The offline rules match staples by name. A blazer named "Black Jacket" isn't recognised as a blazer (Claude reads it properly).
- Suggestions can't be dismissed one by one ("I don't wear belts"). *Ask Dardar again* is the only lever.
- There are no product links or images for the suggested pieces: the app has no shopping integration.
