# Phase 4: AI layer

**Status:** Planned (follows Phase 3)

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
