# Phase 5: Manage pieces, Looks library, faster-feeling AI, installer

**Status:** Done

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

## Step 2: Looks library (done)
- **`/looks`** (`app/pages/looks.vue` + `app/services/pages/looks.service.ts`), linked in the nav between Studio and Wardrobe.
- **Filters:** All, Favourites, Rated, Daily picks, each with a count. **Sort:** Newest, Best, Worst. Unrated looks always sort last; newest wins ties. Both live in the URL (`?filter=favourites&sort=score-desc`), so Back and reload keep them.
- **Cards** reuse `home/LookCard.vue`, which gained an optional `actions` prop: **Open in Studio** and **Delete**. The heart (favourite) works as on Home.
- **Open in Studio** pushes `/studio?look=<id>`. `useStudioPage.init` calls `openLook()`, which puts the look's pieces on the dress form, restores its AI badges and opens its verdict. Changing a piece marks the verdict stale, as before.
- **Delete** asks for confirmation (`UiDialog size="sm"`). Deleting today's pick is allowed; Home styles a new one the next time it loads, and the dialog says so.
- **Pure functions:** `filterLooks()` and `sortLooks()` in `shared/utils/looks.ts`.
- **Tests:** utils; the page service (filter and sort in the URL, open, delete); Studio `?look=` loading; a page render test; e2e (`looks.spec.ts`: filter favourites, open in Studio shows the verdict, delete).

## Step 3: Faster-feeling AI (done)
The Studio now shows the look taking shape instead of a 20–30 s spinner, and the stylist can be cancelled.

- **Contract:** `StyleAdvisor.suggestLook(request, { signal, onProgress })` and `WardrobeGateway.generateLook(request, { signal, onProgress })`. The plan proposed a separate `suggestLookStream` method; an optional second argument keeps a single code path, and providers that can't stream simply never call `onProgress`.
- **`StyleProgress`:** `{ stage: 'reading' | 'picking' | 'rating', title?, aiItemIds, verdict? }`.
  - `aiItemIds` only ever contains real pieces from the allowed categories (`pickLook()`, extracted from `toSuggestion()`, applies the same rules).
  - Progress never goes backwards. In the live run the CLI once started its structured output over; a retry only shows once it has caught up.
- **Partial JSON:** `server/ai/partialJson.ts` reads JSON that stops anywhere. A string value being written is kept (so the title and verdict stream); a half-written array element (an id) or an unfinished number is left out.
- **CLI:** `--output-format stream-json --verbose --include-partial-messages`. The spike showed the `--json-schema` answer streams as `input_json_delta` chunks of a `StructuredOutput` tool call, and the final `result` line still carries `structured_output`. A recorded stream is the fixture `tests/fixtures/cli-stream-json.jsonl`.
- **API:** `client.beta.messages.stream()` with the same structured output; `text` snapshots feed the reader, `finalMessage()` gives the validated `parsed_output`, and `{ signal }` aborts the request.
- **Cancel:** `runProcess` takes a `signal` and kills the CLI; the SDK request is aborted; `StylingService` checks the signal again before saving, so a cancelled look is never stored, even if the stylist answered anyway.
- **Server:** `POST /api/looks/generate/stream` (server-sent events: `progress`, then `done` with the saved look, or `error` with `{ statusCode, message }`). Closing the connection cancels the stylist. The JSON endpoint stays.
- **Client:**
  - `HttpWardrobeGateway` always uses the stream endpoint (`shared/utils/sse.ts` parses it). The mock replays the picks and verdict as progress.
  - The `styleMatches` store keeps `progress` and `cancelGenerate()`; a cancel is not an error.
  - **Studio:** the AI's picks land on the dress form as soon as they are chosen, and their placeholders disappear. The title and the verdict sentence stream in at the top left. The Generate button becomes a progress pill ("Reading your wardrobe…", "Choosing pieces…", "Writing the verdict…") with **Cancel**, which puts the form back as it was.
- **Home:** the daily pick is a single request the server shares between callers, so it doesn't stream. The placeholder shows stages that follow the clock instead. There is no Cancel, because Home isn't blocked while it waits (a change from the plan).
- **Tests:** the partial-JSON reader; the progress reporter (only allowed pieces, no going backwards); `runProcess` (streaming stdout, abort kills the child); the CLI stream against the recorded fixture split into odd chunks; both advisor contracts (progress only names pieces really added, an aborted signal rejects with `AbortError`); `StylingService` (cancelled looks aren't saved); the SSE route (progress then done, errors as events, a disconnect aborts the stylist and saves nothing); both gateway contracts; the store; the Studio and Home services; the 22 e2e flows (the Studio now generates through the stream). Opt-in live tests: the CLI stream and a CLI cancel.

### Live check (Claude CLI 2.1.312, Opus 5.5)
| Moment | Time |
|---|---|
| "Reading your wardrobe…" | 0.3 s |
| First AI pick on the form ("Choosing pieces…") | 12.5 s |
| Verdict starts streaming | 14.0 s |
| Full verdict and score | 28.5 s |

Cancel during a live run saved nothing, showed no error, and left no `claude` process running.

## Step 4: Installer (done)
- **electron-builder** (`electron-builder.yml`):
  - The Electron shell (`dist-electron` plus `package.json`) goes in the asar; no `node_modules`.
  - The Nitro output ships as an extra resource, `resources/app-server`. Native modules and model files can't load from inside an asar. `electron/paths.ts` (`serverEntry`) picks the packaged or project path.
  - Targets: **AppImage** (Linux) and **NSIS** (Windows, with a choice of folder and a desktop shortcut).
  - Scripts: `npm run dist:linux`, `npm run dist:win`, `npm run test:smoke`.
- **A self-contained, lean server bundle** (`scripts/bundle-server-assets.mjs`, run by `npm run build`):
  - **Bug fixed:** imgly resolved its model folder against the *working directory*. It only worked from the project folder; an installed app would have silently kept every photo's background. `ImglyImageProcessor` now passes `publicPath` from Node's module search paths (`imglyPublicPath()`), and the build copies the `medium` model (22 chunks, 88 MB) into `.output`.
  - Only this platform's CPU ONNX runtime is kept. The 480 MB CUDA provider, TensorRT and the other OSes are dropped.
  - Sizes: `.output` 516 MB → 129 MB; the AppImage is **214 MB**; unpacked 402 MB (about 270 MB of that is Electron).
- **API key in the installed app:**
  - The main process's key handling moved to `electron/secrets.ts` (`createSecretHandler`, unit-tested) and uses the async `safeStorage` API. The sync calls are deprecated in Electron 45.
  - **Bug fixed:** with no OS keychain (here: WSL; on Linux, no GNOME Keyring or KWallet), saving a key failed with a bare 500. Now `SecretStore.storage()` reports `keychain`, `private-file` (dev) or `unavailable`. Without a keychain the key is never written; Settings disables the field and explains how to use `ANTHROPIC_API_KEY` instead.
  - The settings view's `secureStorage: boolean` became `keyStorage`.
- **Icon:** `scripts/generate-icon.mjs` draws a rose Didone-style "D" with a gold hairline on ivory as pure SVG paths (no font dependency), saved as `build/icon.png`. electron-builder derives the `.ico` and Linux sizes from it.
- **CI:** `.github/workflows/release.yml` (manual run). On `windows-latest` and `ubuntu-latest` it runs `npm ci`, then the unit tests, the installer build and the packaged smoke test (Linux under xvfb), and uploads the installer.
- **Typecheck:** `npm run typecheck` also checks `electron/` (`tsconfig.electron.json`).

### Smoke test (`tests/smoke/packaged.spec.ts`, `release/linux-unpacked`, brand-new profile)
1. Starts empty: no demo data, "No recommendation yet".
2. Adds a real photo, and the **bundled model removes the background** (no fallback message).
3. Styles it with the Offline stylist and shows a score.
4. API key: with a keychain, it is saved, encrypted (the file holds no `sk-ant`), and still there after a restart. Without one, the field is disabled and explained, and no key file is written. This machine took the second path.
5. Restarts: the piece is still in the wardrobe.

The test gets its fresh data folder from `DARDAR_USER_DATA`, which the main process honours before startup. Faking the user profile instead (`USERPROFILE`/`APPDATA`) crashed Chromium on Windows.

**CI** (run 40719202233): Windows and Linux both pass the unit tests, the installer build and this smoke test, and attach the installers: `.exe` 216 MB, AppImage 213 MB. electron-builder runs with `--publish never`, because otherwise it tries to publish a GitHub release from CI.

The AppImage file itself was also launched with a clean profile (`APPIMAGE_EXTRACT_AND_RUN=1`) and opened on an empty Home.

### Known limits
- The builds are unsigned (SmartScreen will warn), and there is no macOS build.
- The first background removal after a start loads the model, which takes a few seconds.
- Saving an API key on Linux needs a system keychain.
