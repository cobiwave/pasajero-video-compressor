# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**PASAJERO Video Compressor**: a local-only web GUI for compressing videos with ffmpeg for social networks and the web (per-destination presets). The user pastes a filesystem path (not an upload); the server reads and writes files directly on disk. Requires Node 18+ and `ffmpeg`/`ffprobe` on PATH.

## Commands

```bash
npm install
npm run dev        # API (tsx watch server/index.ts, :5174) + Vite (:5173) via concurrently
npm run typecheck  # tsc -b (project references; also emits the server to dist-server/)
npm run build      # tsc -b && vite build -> dist-server/ + dist/
npm start          # node dist-server/server/index.js; serves dist/ + API on http://127.0.0.1:5174
```

There are no tests, linter, or formatter configured. `PORT` env var overrides the API port (but `vite.config.ts` hardcodes the `/api` proxy to 5174). TypeScript is `strict`; `any` is not allowed — external data (request bodies, ffprobe JSON, stream messages, localStorage) is typed `unknown` and validated with zod.

## Architecture

TypeScript project references: `tsconfig.app.json` (src + shared, bundler resolution, noEmit), `tsconfig.node.json` (vite.config.ts), `tsconfig.server.json` (server + shared, NodeNext, emits to `dist-server/`). Because the server uses NodeNext, relative imports in `server/` and `shared/` need `.js` extensions.

- **[shared/](shared/)** — imported by both sides.
  - `constants.ts`: the single source of allowed values (`X264_PRESETS`, `WIDTHS`, `FPS_OPTIONS`, `CRF_RANGE`, `CRF_UI_RANGE`) as `as const` arrays.
  - `schemas.ts`: zod schemas (request bodies, `VideoInfo`, `StreamMessage` discriminated union, health/reveal responses, ffprobe output subset).
  - `types.ts`: types inferred from the constants/schemas, plus `Preset`, `PresetId`, `PlatformLimits`, client `Status`.
  - `presets.ts`: per-destination presets with platform limits. Limits only drive non-blocking warnings. Unverified values carry `// TODO: verificar`.
- **[server/index.ts](server/index.ts)** — single Express file. Endpoints:
  - `GET /api/health` — checks `ffmpeg -version`.
  - `POST /api/pick` — opens the OS-native file dialog from the server ([server/picker.ts](server/picker.ts): `osascript` on macOS, PowerShell `OpenFileDialog` on Windows, `zenity`→`kdialog` on Linux) and returns `{ path: string | null }` (null = cancelled). Browsers never expose real file paths, which is why this lives server-side. One dialog at a time (409 otherwise); client disconnect aborts the dialog.
  - `POST /api/probe` — zod-validates the body, `cleanPath()` normalizes pasted paths (quotes, `\ ` escapes, `~`, `file://`), then `ffprobe` JSON → `VideoInfo`.
  - `POST /api/compress` — validates with `CompressRequestSchema` (whitelists come from `shared/constants.ts`), re-probes, builds ffmpeg args, and **streams NDJSON** `StreamMessage`s (`start` / `progress` / `done` / `error`). Progress comes from parsing `-progress pipe:1` blocks on stdout. Client disconnect (`res.on('close')`) kills ffmpeg with SIGKILL and deletes the partial output.
  - `POST /api/reveal` — opens the file in Finder/Explorer, but only for paths in the in-memory `outputs` Set (files produced this session).
  - Validation errors map to Spanish messages per field (`FIELD_ERRORS`); malformed JSON returns a JSON `ApiError`. In production, serves `dist/` with an SPA fallback (project root is found by walking up to `package.json`, so it works from `server/` and `dist-server/server/`).
- **[src/](src/)** — `App.tsx` only composes. Logic lives in hooks (`useHealth`, `usePickFile`, `useProbe`, `useCompress` — reads the NDJSON stream and cancels via `AbortController`, which triggers the server-side kill — and `useSettings`, which persists settings + `presetId` to `localStorage` under `video-compressor:settings`). UI pieces live in `src/components/`; `src/lib/` has the fetch helpers, formatters and limit warnings.

### Design system

Mirrors [pasajero-website](https://github.com/cobiwave/pasajero-website)'s `app/globals.css`; keep them in sync.

- **[src/styles/globals.css](src/styles/globals.css)**: tokens + reset + grid, copied from the site. `1rem = 10px`; breakpoints in `em`, mobile first with range syntax (`@media (width >= 48em)` tablet, `75em` desktop). Tokens: `--grid-*` (4/8/12 columns), `--space-section`, `--fs-*`, `--lh-*`, `--color-*` (light palette, no accent color). App-only extensions are marked as such: `--space-block`, `--font-mono` (paths/commands), `--color-danger`.
- **Grid**: `.container` (page-level 4/8/12 columns) and `.subgrid` (inherits parent tracks), both in `:where()` (zero specificity). Header, each `Section` and the footer are `.container`s; on desktop the section head takes columns 1–3 and `.sectionBody` (a subgrid) columns 4–12, which `.meta`, `.presets` and `.settings` subgrid again.
- **[src/styles/fonts.css](src/styles/fonts.css)**: Neue Haas Display (Roman = 400, Medium = 500, remapped like the site) and Stretch Pro (only for the "PASAJERO" wordmark). `local()` first, so the copies installed on the Mac are used; the files in `src/assets/fonts/` are the fallback. Medium's internal name is `NeueHaasDisplay-Mediu` (sic).
- [src/App.css](src/App.css) uses tokens only, with native CSS nesting. Dev-only grid overlay: press **`g`** ([GridOverlay.tsx](src/components/GridOverlay.tsx), loaded only when `import.meta.env.DEV`).

## Invariants to preserve

- Server binds to `127.0.0.1` only — it executes ffmpeg on arbitrary local paths, so never expose it on the network.
- Commands are spawned without a shell (`spawn(cmd, args)`); keep user input as discrete args and keep the zod validation in `/api/compress`.
- Only downscale: the `scale` filter is applied only if source width > target, and `fps` only if source fps > target. Otherwise dimensions are just forced even (required by `yuv420p`).
- Output is always H.264 (`libx264`), `yuv420p`, `+faststart`, written next to the source as `<name>-compressed.mp4` (`-2`, `-3`… if taken). Audio is dropped (`-an`) unless requested, then AAC 128k.
- To add an allowed value, change `shared/constants.ts` only; add its UI label in `SettingsForm.tsx` (the `Record<…>` label maps make the compiler flag missing ones).

## Conventions

All user-facing strings, error messages, code comments, and the README are in Spanish (Rioplatense voseo: "Pegá", "Abrí"). Keep new text consistent.
