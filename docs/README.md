# Dardar Wardrobe: documentation

Dardar Wardrobe is a personal wardrobe database with an AI fashion advisor. It runs as an Electron + Nuxt 4 desktop app, for a single user, with data kept locally.

- **Add clothes:** the user uploads a photo. The background is removed and the clean image is saved with the details the user enters.
- **Get looks:** Claude style-matches the user's existing clothes into looks, with or without a custom prompt. It runs through the Claude Code CLI or the Anthropic API, whichever the user prefers.

## Documents

| Document | What it covers |
|---|---|
| [PLAN.md](PLAN.md) | The approved plan: product idea, tech stack, design direction, all phases |
| [architecture.md](architecture.md) | MVC + SOLID layout, the rule that `.vue` files are markup only and services hold the logic, how data flows, design tokens, testing conventions and gotchas |
| [phases/phase-0-scaffolding.md](phases/phase-0-scaffolding.md) | Project setup: Nuxt, Electron and test tooling |
| [phases/phase-1-domain-model.md](phases/phase-1-domain-model.md) | Models, contracts, utilities and seed data |
| [phases/phase-2-ui-prototype.md](phases/phase-2-ui-prototype.md) | The frontend prototype on a mock gateway: Home, Wardrobe, Add item, Style Studio |
| [phases/phase-3-backend.md](phases/phase-3-backend.md) | Nitro controllers, SQLite (`node:sqlite`) persistence, image storage, HTTP gateway |
| [phases/phase-5.md](phases/phase-5.md) | Managing pieces (edit/delete), Looks library, faster-feeling AI, installer |
| [phases/phase-4-ai.md](phases/phase-4-ai.md) | Local background removal; Claude (CLI or API) or Offline styling and brutal ratings; settings; daily pick; add-item pre-fill |

## Phase status

| Phase | Status | Commits |
|---|---|---|
| 0: Scaffolding | Done | `a14d9ac`, `54c328f` |
| 1: Domain model | Done | `9e99bf5` |
| 2: UI prototype | Done, awaiting review | `1e0c0a4`, `a9fe6aa`, `745e576`, `079603e`, `09b754b`, `5cd5013` |
| 3: Backend | Done | `8c238ef` |
| 4: AI | Done | `4072a35`, `e8f0760`, `879c622` |
| 5: Manage, library, streaming, installer | In progress (Step 1 done) | |

## Running the app

```bash
npm install          # also runs `nuxt prepare`
npm run dev          # Nuxt dev server + Electron window
npm run dev:web      # Nuxt only, in a browser at http://localhost:3000
npm run dev:mock     # backend-free prototype (mock gateway, IndexedDB)
npm test             # Vitest: unit + nuxt projects
npm run test:e2e     # Playwright driving the real Electron app
npm run lint
npm run typecheck
```

Data: the dev server keeps its SQLite database and images in `.data/` and seeds demo clothes into an empty database (`NUXT_DEMO_SEED=false` to start empty). The packaged app stores data in Electron's `userData` folder and starts empty.

AI: on first run the stylist is the Claude Code CLI if it's installed (it uses your Claude login), otherwise the Anthropic API if `ANTHROPIC_API_KEY` is set, otherwise the Offline rules. Change it under **Settings**.

Opt-in tests: `RUN_SLOW=1 npm test` runs the real background-removal model; `RUN_LIVE=1 npm test` makes real Claude calls (CLI, plus the API when `ANTHROPIC_API_KEY` is set).

Requirements:
- Node 22 or later.
- On WSL2, a display through WSLg, so the Electron window can open.
- `npx playwright install chromium`, needed only for the helper screenshot scripts.
