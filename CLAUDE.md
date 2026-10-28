# Dardar Wardrobe

A personal wardrobe database with an AI fashion advisor, built as an Electron + Nuxt 4 (SPA) desktop app. It is single-user and local-first.

- The user uploads a photo of a garment. The background is removed (an `ImageProcessor`; Claude cannot edit images), and the clean image is stored with the details the user enters.
- On demand, Claude style-matches existing clothes into looks, with or without a custom prompt. It runs through the **CLI** (`claude -p`) or the **API** (Anthropic SDK), whichever the user picks.

The full plan, with its phases, is in `docs/PLAN.md`.

## Commands
- `npm run dev`: Nuxt dev server and Electron window. `npm run dev:web` runs Nuxt only, in a browser.
- `npm test`: Vitest. The `unit` project runs on node for `tests/unit`; the `nuxt` project runs on happy-dom for `tests/nuxt`.
- `npm run test:e2e`: Playwright drives the real Electron app against `nuxt dev --port 3123`.
- `npm run lint` and `npm run typecheck`.

## Hard rules
1. **TDD.** Write a failing test first, make it pass, then refactor. Every service, store, gateway and util has tests.
2. **UI first.** Do not build any backend (`server/`) until the user signs off on the UI prototype. Until then the frontend runs on `MockWardrobeGateway`.
3. **MVC.**
   - Model: `shared/models` (zod schema plus type), `shared/contracts` (interfaces), `shared/utils` (pure functions).
   - View: `app/pages`, `app/components`, `app/layouts`.
   - Controller: `app/services` and `app/stores` on the client; later, `server/controllers` → `server/services` → `server/repositories`.
4. **Views are markup only.**
   - A `.vue` file holds only `<template>` and `<style>`, plus a `<script setup>` limited to `defineProps`, `defineEmits` and `const vm = useXxx(props, emit)`.
   - All state, computed values, watchers, handlers and store access go in the matching service. The services tree mirrors the views: `app/components/wardrobe/ClothesRail.vue` ↔ `app/services/components/wardrobe/ClothesRail.service.ts`.
   - ESLint enforces this.
   - Services import Vue and Pinia APIs explicitly; they do not rely on auto-imports, so they stay testable.
5. **SOLID.**
   - Depend on the contracts in `shared/contracts`.
   - Concrete classes are wired in exactly one place: `app/plugins/gateway.ts` on the client and `server/container.ts` on the server.
   - A new implementation is a new class, not an edit to existing ones.
   - Every implementation must pass the shared contract suite in `tests/contracts`.
6. **Design.** The clothes images are the hero. The UI is quiet, girly, fashionable and simple:
   - Ivory and cream surfaces.
   - Blush or rose as the only accent, used sparingly; gold only for tiny details.
   - Cormorant Garamond for display text and DM Sans for the UI.
   - No frames or overlays on garment images. Use the `.garment` utility.
   - The tokens are in `app/assets/css/main.css`.

## Code-navigation tools
Serena (`dardar_weardrobe`), jcodemunch (`local/dardar_weardrobe-427e0a50`), codebase-memory (`var-www-html-dardar_weardrobe`).

## Git
Commit and push to `origin main` after every phase and at every break.
