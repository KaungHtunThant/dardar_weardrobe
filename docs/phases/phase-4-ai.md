# Phase 4: AI layer

**Status:** Done

## Goal
Make the AI real:
1. **A clean garment image:** remove the background from an uploaded photo, so only the garment remains.
2. **Style Studio styling:** complete the user's partial outfit in the categories they opened to the AI, following their optional prompt, and **rate the look with brutal honesty**: a 1–10 score, a verdict, what works, what doesn't, and fixes from their own wardrobe.
3. **Today's recommendation:** an AI-styled daily look on Home.
4. **Add-item pre-fill:** suggest the name, category, colours, seasons and occasions from the photo.

The user chooses **Claude Code CLI**, **Anthropic API** or **Offline**. Offline is the rule-based advisor from Phase 2, which needs no network.

## Important: background removal is not done by Claude
Claude can understand images but cannot create or edit them. Background removal therefore sits behind `shared/contracts/ImageProcessor.ts`:
- **Default:** `@imgly/background-removal-node`. It runs an ONNX model locally, offline and for free. If the model fails, the photo is kept as-is and the UI says so.
- **Optional, later:** an image-generation provider for a fully re-rendered "product shot".

## Scope
- **`ImglyImageProcessor`,** injected into `PhotoService` in place of the Phase 3 pass-through.
- **`StyleAdvisor`** providers. All of them must pass `tests/contracts/styleAdvisor.contract.ts`:
  - **`RuleBasedStyleAdvisor`:** offline, already built.
  - **`ClaudeCliProvider`:** runs `claude -p` with JSON output, using the item details as context. It detects whether `claude` is on the PATH.
  - **`ClaudeApiProvider`:** `@anthropic-ai/sdk`, with the model configurable and defaulting to the latest Claude model.
  - **Shared prompt builder and parser:** the wardrobe goes in as compact JSON; the reply is validated by zod; ids that aren't in the wardrobe are rejected. The system prompt demands blunt, specific honesty and no flattery.
- **`GarmentTagger`:** CLI and API vision providers that pre-fill the add-item details from the clean image.
- **Settings page (`/settings`)** and `GET/PUT /api/settings`:
  - The advisor choice (CLI, API or Offline), the model, and CLI availability.
  - The API key, kept behind a `SecretStore` contract:
    - in the packaged app, Electron `safeStorage` reached over the utility-process message port;
    - in dev, `ANTHROPIC_API_KEY` or a `0600` file in `DATA_DIR`.
- **`GET /api/looks/today`:** returns today's AI pick, generating one once per day if needed.

## Test plan (TDD)
- One advisor contract suite runs against every provider. The CLI provider uses a fake process runner; the API provider uses a fake SDK client.
- Prompt-builder and response-parser unit tests cover malformed JSON, unknown ids, and scores out of range.
- `ImageProcessor` tests use a stub, plus an opt-in slow test with the real model.
- Settings and secret-store tests use temporary directories.

## Verification
- Live smoke tests:
  - CLI mode, with `claude` at `~/.local/bin/claude`.
  - API mode, with a key.
  - Background removal on a real photo.
- The e2e tests stay deterministic by running the Offline advisor.

## What was built
- **Background removal:** `server/infrastructure/ImglyImageProcessor.ts`.
  - The ONNX model loads lazily; SVGs are passed through; the output is PNG.
  - `PhotoService` falls back to the original photo if removal fails, and the dialog says so.
  - Checked on a real photo, in the dev server and in the production build under Electron's Node.
- **Stylist prompt and cleaner:** `server/ai/stylePrompt.ts`.
  - A byte-stable "brutal honesty" system prompt.
  - The request goes in as JSON between `<wardrobe_request>` tags.
  - `toSuggestion()` makes any model output obey the Studio rules: it keeps the picks; adds only from allowed categories, one each; never pairs a dress with separates; uses real ids only; clamps the score; trims verdicts at sentence boundaries; and keeps only valid fixes.
- **Advisors:**
  - `ClaudeCliStyleAdvisor`: `claude -p --output-format json --json-schema … --tools "" --no-session-persistence`, with the prompt on stdin.
  - `ClaudeApiStyleAdvisor`: `client.beta.messages.parse` with `betaZodOutputFormat`, a cached system prompt, `fallbacks: "default"` (server-side refusal fallback), effort taken from settings, and refusal handling.
  - Both pass the shared StyleAdvisor contract through the real prompt and cleaner, using a fake model.
- **Taggers:** `ClaudeApiTagger` (base64 image block, effort `low`) and `ClaudeCliTagger` (may only `Read` the image folder). `toDetailsSuggestion()` keeps only valid vocabulary. `POST /api/items/suggest` is the endpoint. The add dialog pre-fills only untouched fields and ignores late answers.
- **Settings:**
  - `shared/models/settings.ts` and `server/settings/SettingsService.ts`.
  - On first run it picks the Claude CLI if installed, else the API if a key is set, else Offline.
  - The advisor and tagger are resolved per request, so a change applies immediately.
  - The API key is never returned to the UI, and an environment `ANTHROPIC_API_KEY` wins.
  - **Key storage:** `ElectronSecretStore` in the packaged app (the main process encrypts with `safeStorage`; requests go over the utility-process port), and `FileSecretStore` (`0600`) in dev.
  - The Settings page shows stylist cards with live CLI and key status, plus model, effort and API key fields. The Studio shows "Styled by …".
- **Daily pick:** `server/services/TodayService.ts`.
  - It styles one look per day with seasonal categories (outerwear in autumn and winter), saves it with `dailyPickDate`, and merges concurrent requests.
  - If the chosen stylist fails, it uses the offline rules.
  - Home shows a "styling today's look" placeholder while it works.

## Added after Phase 4: Start fresh
- **Settings → Start fresh → "Clear wardrobe…"** opens a small confirmation dialog ("Keep my wardrobe" / "Delete everything").
- **What it deletes:** every item, look and stored photo, through `POST /api/wardrobe/clear`, which requires `{ confirm: true }`.
- **What it keeps:** the stylist settings and the API key.
- **A `wardrobe-cleared` marker** in the data folder stops the demo seed from coming back on the next start.
- The page stores empty themselves straight away (`wardrobe.clearAll()`, `styleMatches.forget()`).
- **Tests:**
  - the gateway contract (mock and HTTP);
  - the API: photos deleted, confirmation required;
  - a restart with the data kept empty;
  - the Settings service;
  - an e2e flow: cancel, then clear, then empty Home and Wardrobe, then reload, with settings kept.

## Tests
- Contract suites:
  - StyleAdvisor: rule-based, CLI (fake process), API (fake client).
  - WardrobeGateway: mock and HTTP, now including settings, suggestions and the daily pick.
- Unit tests cover the prompt payload, the cleaner, the CLI schema, CLI and API error handling, settings and secrets (including the `0600` file and the parent-port protocol), taggers, and today's look (idempotent, concurrency, season, fallback, empty wardrobe).
- E2E: 17 flows, run with the Offline stylist so they're deterministic. They include a real photo going through background removal, and the Settings flow.
- Opt-in: `RUN_SLOW=1` runs the real background-removal model; `RUN_LIVE=1` (plus `ANTHROPIC_API_KEY` for the API) runs real Claude calls.

## Live verification (Claude CLI 2.1.312)
| Feature | Result | Time |
|---|---|---|
| Daily pick | "Wednesday Trench Classic", 7/10: "Correct, comfortable and completely predictable…" | 16 s |
| Studio (linen tee + burgundy skirt, "gallery opening, a bit artsy") | "Burgundy After Dark", 6/10, with specific fails and a black-tee swap | 19 s |
| Background removal (real photo) | Clean PNG | 3 s |
| Vision pre-fill | "Blush Longline Cardigan · outerwear · blush · spring/autumn · casual/work/lounge" | 12 s |

The API path hasn't been called live from this machine (no key). It is covered by the contract tests and the SDK's type checks.

## Notes
- The production server bundle is about 537 MB, mostly the offline background-removal model plus the ONNX runtime and image libraries.
- Packaging an installer (electron-builder AppImage) is the remaining step for distribution.
