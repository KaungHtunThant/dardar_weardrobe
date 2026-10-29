# Dardar Wardrobe: documentation

Dardar Wardrobe is a personal wardrobe database with an AI fashion advisor. It runs as an Electron + Nuxt 4 desktop app, for a single user, with data kept locally.

- **Add clothes:** the user adds photos (several at once) and carries on. In the background, the stylist finds the garment and Dardar cuts exactly that out (no person, hanger or background), centred like the sample images. The user then reviews the suggested details and saves.
- **Get looks:** Claude style-matches the user's existing clothes into looks, with or without a custom prompt. Every Claude call runs as **Dardar**, the stylist agent set up on first launch, through the Claude Code CLI or the Anthropic API, whichever the user prefers.
- **What's missing:** Home lists the few pieces the wardrobe lacks, why, and what the user already owns to wear each with.
- **Dressed for the weather:** on first launch Dardar suggests the user's city (they can pick another, here or in Settings). Today's recommendation and the Studio's *Generate & rate* then dress for, and judge against, that day's forecast (Open-Meteo).

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
| [phases/phase-6.md](phases/phase-6.md) | Dardar the stylist agent (first launch); the garment studio (cut out exactly the garment, digitalized); the upload queue and tray |
| [phases/phase-7.md](phases/phase-7.md) | The user's city (first launch, Settings) and the weather in today's look and the Studio |
| [phases/phase-8.md](phases/phase-8.md) | Home: what your wardrobe is missing (Claude or offline rules, climate-aware) |

## Phase status

| Phase | Status | Commits |
|---|---|---|
| 0: Scaffolding | Done | `a14d9ac`, `54c328f` |
| 1: Domain model | Done | `9e99bf5` |
| 2: UI prototype | Done, awaiting review | `1e0c0a4`, `a9fe6aa`, `745e576`, `079603e`, `09b754b`, `5cd5013` |
| 3: Backend | Done | `8c238ef` |
| 4: AI | Done | `4072a35`, `e8f0760`, `879c622` |
| 5: Manage, library, streaming, installer | Done | `60d0b16`, `5de3875`, `31a6317`, `4bf1da1` (+ CI fixes) |
| 6: Stylist agent, garment studio, upload queue | Done | `7e5a538`, `f834a7e`, `73ffa3d`, `1f60d13` |
| 7: Location and weather | Done | `dfd4d6d` |
| 8: Missing pieces | Done | `78cb28a` |

## Running the app

```bash
npm install          # also runs `nuxt prepare`
npm run dev          # Nuxt dev server + Electron window
npm run dev:web      # Nuxt only, in a browser at http://localhost:3000
npm run dev:mock     # backend-free prototype (mock gateway, IndexedDB)
npm test             # Vitest: unit + nuxt projects
npm run test:e2e     # Playwright driving the real Electron app
npm run lint
npm run typecheck    # Nuxt app + the Electron main process
```

## Installers

```bash
npm run dist:linux   # release/Dardar-Wardrobe-<version>-x86_64.AppImage
npm run dist:win     # release/Dardar-Wardrobe-<version>-x64.exe (NSIS) — run on Windows
npm run test:smoke   # Playwright against the unpacked build, with a brand-new profile
```

- Each platform builds its own installer, because the server's native modules (ONNX runtime, sharp) must match it. The **Release builds** GitHub Actions workflow (Actions tab → Run workflow) builds and smoke-tests the Windows `.exe` and the Linux AppImage and attaches them to the run.
- `npm run build` makes `.output` self-contained: `scripts/fetch-models.mjs` fetches the clothes-segmentation model (sha256-checked), and `scripts/bundle-server-assets.mjs` adds it and the background-removal model and keeps only this platform's CPU ONNX runtime.
- electron-builder (`electron-builder.yml`) ships `.output` as `resources/app-server`, outside the asar archive.
- The icon is drawn by `npm run icon` (`build/icon.png`).
- **Known limits:** the builds are unsigned, so Windows SmartScreen and macOS Gatekeeper will warn. There is no macOS build yet. The first background removal after a start loads the model, which takes a few seconds. Linux needs a system keychain (GNOME Keyring or KWallet) to save an API key; without one, set `ANTHROPIC_API_KEY` instead.
- **Licence:** the clothes-segmentation weights (SegFormer B2 clothes) are under NVIDIA's SegFormer licence, **non-commercial use only**. The app must not be sold with them; swapping the model means one new `ClothesSegmenter` class.

Data: the dev server keeps its SQLite database and images in `.data/` and seeds demo clothes into an empty database (`NUXT_DEMO_SEED=false` to start empty). The packaged app stores data in Electron's `userData` folder and starts empty.

AI: on first launch the app sets up **Dardar**, the stylist agent (`<data>/agent/agents.json`, a Claude CLI agents file), and saves the stylist it picked: the Claude Code CLI if it's installed (it uses your Claude login), otherwise the Anthropic API if `ANTHROPIC_API_KEY` is set, otherwise the Offline rules. Change it under **Settings**, where Dardar can also be set up again.

Weather: the welcome guesses the city from this computer's public IP address (GeoJS) and the user confirms it or searches for another (Open-Meteo geocoding); it is saved in `settings.json` and can be changed or removed under **Settings → Your city**. Forecasts come from Open-Meteo (free, no key, non-commercial use), cached for 30 minutes; only the city's coordinates are sent. Without a city, or offline, everything works as before. `NUXT_WEATHER=demo` swaps in offline stand-ins (the e2e server uses them).

Opt-in tests: `RUN_SLOW=1 npm test` runs the real background-removal and clothes-segmentation models (outputs in `test-results/studio/`); `RUN_LIVE=1 npm test` makes real Claude calls (CLI, plus the API when `ANTHROPIC_API_KEY` is set) and calls Open-Meteo and GeoJS.

Requirements:
- Node 22 or later.
- On WSL2, a display through WSLg, so the Electron window can open.
- `npx playwright install chromium`, needed only for the helper screenshot scripts.
