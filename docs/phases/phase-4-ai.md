# Phase 4: AI layer

**Status:** Planned

## Goal
Add the two AI features:
1. **A clean garment image:** remove the background from an uploaded photo, so only the garment remains.
2. **Style matching:** combine the user's existing clothes into a look in the style the user wants, with or without a custom prompt, and explain it.

The user chooses whether the AI runs through the **Claude Code CLI** or the **Anthropic API**.

## Important: background removal is not done by Claude
Claude, through either the CLI or the API, can understand images but cannot create or edit them. Background removal therefore sits behind its own contract, `shared/contracts/ImageProcessor.ts`:
- **Default:** `@imgly/background-removal-node`. It runs an ONNX model locally, offline and for free.
- **Optional, later:** an image-generation provider (for example OpenAI gpt-image or Gemini image editing) for a fully re-rendered "product shot".

Claude still does the vision work:
- It suggests the category, colours and tags to pre-fill the add-item form.
- It does all of the style matching.

## Scope
- **`ImageProcessor`:** an imgly implementation, used by the photo-upload route from Phase 3.
- **`StyleAdvisor`** (`shared/contracts/StyleAdvisor.ts`, `suggestLook({ wardrobe, pinnedItemIds, fillCategories, prompt? })`) with two providers. Both replace the prototype's `MockStyleAdvisor`, must pass `tests/contracts/styleAdvisor.contract.ts`, and return a **brutally honest rating**: a 1–10 score, a verdict, what works, what doesn't, and fixes from the user's own wardrobe.
  - **`ClaudeCliProvider`:** spawns `claude -p --output-format stream-json` and passes the item details and the clean-image file paths. It detects whether `claude` is on the PATH.
  - **`ClaudeApiProvider`:** uses `@anthropic-ai/sdk` with vision and streaming. The model is configurable and defaults to the latest Claude model.
  - Both return structured JSON validated by zod (`StyleSuggestion`, including the `StyleRating`). Any id that isn't in the wardrobe is rejected. The system prompt tells the model to be blunt and specific: no flattery.
- **Settings:**
  - Choose CLI or API mode, and the model.
  - The API key is encrypted with Electron `safeStorage` and passed to Nitro through the environment.
- **Endpoints:**
  - A server-sent-events endpoint `/api/advisor/look`, with cancellation.
  - Daily-pick generation, which feeds Home's "Today's recommendation".
  - Vision-based pre-fill of the add-item form.

## Test plan (TDD)
- One `StyleAdvisor` contract suite runs against both providers. The CLI provider is tested with a fake child process, and the API provider with a mocked SDK client.
- The `ImageProcessor` contract checks that the output is a PNG with transparency. It runs against a stub, plus an optional slow test with the real model.
- Service tests cover prompt building (the wardrobe context, and how an optional prompt is handled) and parsing or rejecting invalid model output.

## Verification
- Live smoke tests:
  - CLI mode, with `claude` at `~/.local/bin/claude`.
  - API mode, with a key entered in Settings.
- Background removal on real garment photos.
- End to end:
  - Upload a photo, see the clean image, save it.
  - Ask for a look with and without a prompt; the look appears in "Recently styled".
