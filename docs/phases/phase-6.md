# Phase 6: Dardar the stylist agent, garment studio, upload queue

**Status:** Done

The user asked for four things:
- when a photo is uploaded, keep only the garment and remove everything else;
- "digitalize" the garment so it looks like the sample images;
- create a fashion-advisor agent on first launch and use only that agent;
- queue the processing of uploads so the user can do something else meanwhile.

Decisions the user made during planning:
- The agent is **local**: a Claude CLI agent file in the data folder. The API uses the same persona as its cached system prompt. Anthropic Managed Agents were rejected as slower, costlier and API-only.
- **The provider choice stays** (Claude CLI, Anthropic API, Offline); "only the agent" means every Claude call goes through it.
- Digitalizing is **local and free**: no image-generation provider. Claude can't edit images; it only says where the garment is.
- The clothes-segmentation model is **SegFormer**, under a **non-commercial licence** (see Step 3).

Commits: `7e5a538` (agent), `f834a7e` (analyst), `73ffa3d` (studio), `1f60d13` (queue).

## Step 1: Dardar, the stylist agent (done)
- **One persona for every Claude call:** `server/ai/agent/stylistPrompt.ts` (`STYLIST_AGENT_PROMPT`, `STYLIST_AGENT_VERSION`). It has a playbook per task: *style a look*, *describe a garment*, *find the garment in a photo*. Each user message starts with `Task: …`. It replaces the separate `STYLE_SYSTEM_PROMPT` and `TAG_SYSTEM_PROMPT` and is byte-stable, so the API caches it.
- **Contract** `shared/contracts/StylistAgent.ts`: `name`, `systemPrompt()`, `cliAgentsFile()`.
- **`server/agent/LocalStylistAgent.ts`** writes `<data>/agent/agents.json`, a Claude CLI agents file (`{ "dardar-stylist": { description, prompt } }`), and `<data>/agent/agent.json` (name, display name, version, created). It does three things:
  - `ensure()` creates the agent on the first launch, and refreshes the file when the app ships a newer prompt version while keeping the creation date.
  - `recreate()` sets it up from scratch.
  - `BUILT_IN_STYLIST` is the same persona with no file; the providers fall back to it.
- **First launch:** `createContainer()` calls `SettingsService.setUp()`. It runs `ensure()` and **saves the automatically picked stylist** (CLI → API → Offline) to `settings.json`, so the choice no longer changes on its own if the CLI later disappears. NSIS and AppImage have no install hooks, so "on install" means "on the first start".
- **CLI:** `runClaudeCli` runs `--agents <file> --agent dardar-stylist` instead of `--system-prompt`, with `cwd` set to the agent folder (the project's `CLAUDE.md` isn't picked up). In the spike the agent run used about half the input tokens of `--system-prompt`. `--bare` was rejected because it forces API-key login.
- **API:** `system = agentSystem(agent)`, the persona with `cache_control`.
- **UI:**
  - Settings shows a "Dardar, your stylist" card (set-up date, what it thinks with) with **Set up again** (`POST /api/agent/recreate`).
  - Home shows a one-time "Meet Dardar" welcome; dismissing it saves `welcomed: true` in the settings.
- **Tests:** `tests/server/stylistAgent.test.ts` (files, idempotence, version refresh, recreate, CLI args and `cwd`, the API system prompt); settings (`setUp`, `welcomed`, recreate); the gateway contract; the Settings and Home services. Live: the CLI styles a look as the on-disk agent.

## Step 2: The stylist finds the garment (done)
- **Contract** `shared/contracts/GarmentAnalyst.ts`: `analyze(image, { signal })` returns `{ focus: FocusBox | null, worn, details }`. One call on the **original** photo gives the box, whether it is worn, and the add-form suggestion.
- **Implementations:**
  - `ClaudeCliGarmentAnalyst`: reads the photo with the `Read` tool, allowed only in the photo's folder.
  - `ClaudeApiGarmentAnalyst`: base64 image, effort `low`, refusal fallbacks.
  - `OfflineGarmentAnalyst`: knows nothing.

  All pass `tests/contracts/garmentAnalyst.contract.ts`. `SettingsService.resolveAnalyst()` picks one, as for the tagger.
- **Model output goes through `toGarmentAnalysis()`.** It uses `toFocusBox()` (`shared/utils/focusBox.ts`), which reads percentages as fractions, clamps to the photo, and drops tiny or whole-frame boxes, plus `toDetailsSuggestion()`.
- **Fixture:** `tests/fixtures/photos/red-tshirt-worn.jpg`, CC0 from Wikimedia Commons (see `SOURCES.md`).
- **Live (CLI, Haiku 5.5):** `focus {x .05, y .39, w .91, h .61}`, worn, "Red Graphic Oversized Tee", tops, red and gold.

## Step 3: Garment studio, cut out and digitalized (done)
- **`ImageProcessor.removeBackground(image, mimeType, hints?)`**, where `StudioHints` is `{ focus, worn, category }`. There is a new contract suite, `tests/contracts/imageProcessor.contract.ts`.
- **`GarmentStudioProcessor`** (`server/infrastructure/`):
  1. **Upright and cropped:** EXIF rotation, at most 2048 px on the long edge, cropped to the stylist's box plus an 8% margin (`focusRect()`).
  2. **Background matte:** imgly, as before.
  3. **Worn garments:** `ClothesSegmenter` (`SegformerClothesSegmenter`, ONNX, about 0.7 s on the CPU) gives the probability that each pixel is clothing of the category (`clothesLabelsFor()`; tops and dresses are kept together because the model mixes them up). The final alpha is the matte ∩ that probability, with a soft ramp (`combineAlpha()`). Skin, hair and the other clothes go.
  4. **Finish:** erode the alpha 1 px and feather it (no halos); `evenTone()` brightens only dim photos, with one gain on every channel, so colours stay true; trim; centre on a transparent **800×960 (5:6)** canvas with 10% padding; shoes and bags sit low (`studioPlacement()`). There is no baked shadow: the `.garment` CSS adds it, as for the samples.
  - **Fallbacks:** if the segmenter fails or finds under 3% of the crop, only the matte is used; if the matte fails, the caller keeps the original.
- **Tuning found by looking at real outputs:**
  - A contrast stretch first turned the blush sample blouse hot pink, so tone correction became brighten-dim-only.
  - A "skin pixels" metric turned out to count the tee's gold print. The slow test therefore compares against a matte-only cut-out instead: 5,422 skin-like pixels against 14,578.
- **Choosing the model:** on cropped CC0 photos, U²-Net cloth-seg (MIT, 176 MB, 2 s) kept the arms and hair and garbled the second photo. SegFormer B2 clothes (29 MB quantized) removed them cleanly. The user chose SegFormer, accepting its **NVIDIA non-commercial licence**: fine for a personal app or a free share, but the app can't be sold without swapping the model. It sits behind `ClothesSegmenter`, so swapping it means writing one new class.
- **Getting the model:** `scripts/fetch-models.mjs` downloads it from a pinned Hugging Face revision with a sha256 check into `vendor/models/` (gitignored). It runs in `postinstall` (a warning if offline), in `npm run models`, and in `npm run build` (`--strict`). `bundle-server-assets.mjs` copies it to `.output/server/models`, and `segformerModelPath()` searches upwards for it.
- **`GarmentPipeline`** (`server/services/`): analyse (on a 1568 px JPEG preview, `analysisPreview()`) → studio with the hints → save. It reports stages and supports cancelling. If the stylist fails, the whole photo is cut out; if cutting out fails, the original is kept. `PhotoService` (replace photo) uses it too.
- `sharp` and `onnxruntime-node` are now direct dependencies, pinned to the versions imgly ships. `onnxruntime-node` 1.17 lists a types file it doesn't ship, hence `shared/types/onnxruntime-node.d.ts`.

## Step 4: Upload queue (done)
- **Model** `shared/models/upload.ts`: `Upload { state: queued | processing | ready | failed, stage: analyzing | isolating, categoryHint, suggestion, backgroundRemoved, error, … }`. It is stored by `SqliteUploadRepository` (migration 2), which passes the repository contract suite.
- **`UploadService`:**
  - `enqueue()` validates the whole batch, saves the originals and returns at once (`202`).
  - One worker prepares photos **one at a time**, because the models are CPU-heavy. Progress writes are chained, so a late stage update never overwrites the result.
  - `retry`, `discard` (aborts the photo if it is running and deletes its images), and `save(id, details)`, which creates the piece and keeps its images.
  - `resume()` at startup re-queues photos that were interrupted; `stopAll()` runs before *Start fresh* and reset.
- **API:** `GET/POST /api/uploads`, `POST /api/uploads/:id/retry`, `POST /api/uploads/:id/save`, `DELETE /api/uploads/:id`. The `category` form field is the closet the photos were added from.
- **Gateway:** `UploadGateway` (`enqueuePhotos`, `listUploads`, `retryUpload`, `discardUpload`, `saveUpload`). The HTTP gateway implements it, and so does the mock, which steps through the stages with timers. Both pass the gateway contract.
- **Client:**
  - **`uploads` store:** polls every 1.2 s only while something is queued or processing. A poll times out after 10 s, so a slow answer can't stop the next one.
  - **Add dialog:** pick or drop **several** photos; they are queued and the dialog closes ("add as many as you like"). The same dialog **reviews** a ready photo, opening on its details with the cut-out and Dardar's suggestion; the category falls back to the closet's. *Discard this photo* replaces *Use a different photo*.
  - **Upload tray** (`app/components/upload/Tray.vue`, in the layout): a quiet ivory pill, for example "Preparing 2 pieces · 1 ready to add". It opens a list with the stage ("Dardar is looking…", "Cutting it out…", "Ready to add") and **Review**, **Try again** and **Discard**. A blush dot shows when something is ready.
- **Two problems the e2e run found:**
  - **imgly blocks the event loop for about 8 s per photo.** In Phase 5 the user waited anyway; with a background queue, every API call stalled and the tray's polls were dropped. imgly now runs in a **worker thread** (`WorkerImglyImageProcessor`), which keeps the model warm and imports imgly's ESM entry by path, because the built server ships only `index.mjs`. The longest main-thread pause during a photo went from about 8 s to 0.27 s.
  - **`sharp` 0.32 must be loaded by the main thread before a worker loads it.** `nuxt dev` runs the API in a worker, so `nuxt.config.ts` imports `sharp` first. The packaged app (a utility process) loads it in its main thread anyway.
- **Tests:**
  - The queue: order, stages, failure, retry, discard while waiting or running, resume after restart, save, `stopAll`.
  - The repository contract, the API, both gateway contracts.
  - The store (polling starts and stops), the AddDialog and Tray services.
  - e2e: add, then tray, then review and save; two photos keep being prepared while you browse Looks; Discard.
  - Smoke (packaged): a fresh install sets up the agent and shows the welcome; a real photo is cut out in the background and reviewed from the tray.

## Verification
- `npm test`: 491 passed (13 opt-in skipped); lint and typecheck clean.
- `RUN_SLOW=1`: the studio on both fixtures (outputs in `test-results/studio/`); imgly in the worker without blocking.
- `RUN_LIVE=1` (CLI, Haiku 5.5): a look styled as the on-disk agent; the worn tee found.
- `npm run test:e2e`: 23 passed. `npm run test:smoke` against `release/linux-unpacked`: passed.
- The production server, run by hand with the CLI stylist, cut the worn tee out of the CC0 photo in about 22 s, including the Claude call.
- The AppImage itself wasn't produced locally: the disk was full (the unpacked build is what the smoke test uses). CI builds both installers.

## Known limits
- **SegFormer's licence is non-commercial.**
- Where hair or an arm covered the garment there is a hole: nothing is invented, because Claude can't draw.
- The clothes model is trained on people wearing clothes. Flat lays and hangers use the matte only, cropped to the stylist's box, so a hanger hook inside that box can remain.
- Without Claude (Offline) there is no box or category, so the whole photo is cut out and the form starts empty (or with the closet's category).
- `nuxt dev` reloads its server worker after a server-code edit. If `sharp` then complains, restart the dev server.
