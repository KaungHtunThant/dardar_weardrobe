# Phase 0: Scaffolding

**Status:** Done
**Commits:** `a14d9ac` (scaffold), `54c328f` (ignore CLAUDE.md and MCP files)

## Goal
Start from an empty folder and end with an Electron + Nuxt 4 desktop app whose whole toolchain works:
- Unit and component tests.
- End-to-end tests in a real Electron window.
- Linting that enforces the rule that `.vue` files are markup only.
- Type checking.

## What was built
- **Nuxt 4 SPA:** `nuxt.config.ts`, `app/app.vue`.
  - `ssr: false`.
  - Modules: `@pinia/nuxt`, `@nuxt/icon` (lucide, bundled locally), `@nuxt/fonts` (Cormorant Garamond and DM Sans, self-hosted), `@nuxt/eslint`, `@nuxt/test-utils`.
  - Components are registered from `.vue` files only.
  - `runtimeConfig.public.gateway = 'mock'`.
- **Design tokens:** `app/assets/css/main.css`. Tailwind v4 `@theme` holds the ivory, cream, blush, rose and gold palette, the fonts, the shadows, and the `.garment` utility.
- **Electron shell:** `electron/main.ts`, `electron/preload.ts`, built by `scripts/build-electron.mjs` with esbuild into `dist-electron/`.
  - In dev, it loads `DARDAR_URL`, which defaults to `http://localhost:3000`.
  - In production, it runs the built Nitro server (`.output/server/index.mjs`) with `utilityProcess.fork` on `127.0.0.1` at a free port, with `DATA_DIR` set to Electron `userData`.
  - Security settings: `contextIsolation`, `sandbox`, no `nodeIntegration`, external links opened in the system browser.
- **Tests:**
  - `vitest.config.ts`: a `unit` project (node + fake-indexeddb) and a `nuxt` project (`@nuxt/test-utils`, happy-dom).
  - `playwright.config.ts` and `tests/e2e/fixtures.ts`: launch Electron against `nuxt dev --port 3123`.
- **Lint:** `eslint.config.mjs`. Nuxt's flat config, plus a rule that forbids `ref`, `computed`, `watch`, `onMounted`, `storeToRefs` and `use*Store` inside `app/**/*.vue`.
- **Scripts in `package.json`:** `dev`, `dev:web`, `build`, `build:electron`, `test`, `test:watch`, `test:e2e`, `lint`, `typecheck`.
- **Tooling setup:**
  - Serena's language servers are set to `typescript` and `vue`.
  - jcodemunch and codebase-memory are indexed.
  - `CLAUDE.md`, `.serena/`, `.mcp.json`, `.claude/` and `.codebase-memory/` are gitignored.

## Key decisions
- **Electron + Nuxt, with Nitro as the future backend.** One TypeScript stack. Nitro runs inside Electron in production, so the Claude CLI and the Anthropic SDK can run server-side.
- **The project files were written by hand instead of with the interactive `nuxi init`,** to keep full control of the config.
- **The git remote uses SSH** (`git@github.com:KaungHtunThant/dardar_weardrobe.git`). HTTPS had no stored credentials.
- **Electron was confirmed to work under WSLg** (`DISPLAY=:0`).

## How to verify
```bash
npm test && npm run lint && npm run typecheck
npm run test:e2e   # opens Electron windows
npm run dev
```

## Notes
- `CLAUDE.md` and `.serena/` are still in the first commit (`a14d9ac`); they've been untracked since `54c328f`. Removing them from history would need a force-push, so that hasn't been done.
