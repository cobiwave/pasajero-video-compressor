# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A local-only web GUI for compressing screen recordings with ffmpeg, tuned for LinkedIn uploads. The user pastes a filesystem path (not an upload); the server reads and writes files directly on disk. Requires Node 18+ and `ffmpeg`/`ffprobe` on PATH.

## Commands

```bash
npm install
npm run dev     # runs API (node --watch server.js, :5174) + Vite (:5173) together via concurrently
npm run build   # vite build -> dist/
npm start       # node server.js; serves dist/ + API on http://127.0.0.1:5174
```

There are no tests, linter, or formatter configured. `PORT` env var overrides the API port (but `vite.config.js` hardcodes the `/api` proxy to 5174).

## Architecture

Two pieces, no shared code:

- **[server.js](server.js)** — single Express file, ES modules. Endpoints:
  - `GET /api/health` — checks `ffmpeg -version`.
  - `POST /api/probe` — `cleanPath()` normalizes pasted paths (quotes, `\ ` escapes, `~`, `file://`), then `ffprobe` JSON → video metadata.
  - `POST /api/compress` — re-probes, validates options against whitelists (`PRESETS`, `WIDTHS`, `FPS`, CRF 16–36), builds ffmpeg args, and **streams NDJSON** back (`start` / `progress` / `done` / `error` messages). Progress comes from parsing `-progress pipe:1` key=value blocks on stdout. Client disconnect (`res.on('close')`) kills ffmpeg with SIGKILL and deletes the partial output.
  - `POST /api/reveal` — opens the file in Finder/Explorer, but only for paths in the in-memory `outputs` Set (files produced this session).
  - In production, serves `dist/` with an SPA fallback.
- **[src/App.jsx](src/App.jsx)** — single React component holding all state. Reads the NDJSON stream with `TextDecoderStream` and cancels via `AbortController` (which triggers the server-side kill). UI presets (`linkedin`/`light`/`quality`) live here; settings persist to `localStorage` under `video-compressor:settings`.

## Invariants to preserve

- Server binds to `127.0.0.1` only — it executes ffmpeg on arbitrary local paths, so never expose it on the network.
- Commands are spawned without a shell (`spawn(cmd, args)`); keep user input as discrete args and keep the whitelist validation in `/api/compress`.
- Only downscale: the `scale` filter is applied only if source width > target, and `fps` only if source fps > target. Otherwise dimensions are just forced even (required by `yuv420p`).
- Output is always H.264 (`libx264`), `yuv420p`, `+faststart`, written next to the source as `<name>-compressed.mp4` (`-2`, `-3`… if taken). Audio is dropped (`-an`) unless requested, then AAC 128k.
- When adding an option, update both the server whitelist and the UI controls — the UI exposes a subset of what the server accepts (e.g. CRF slider 18–32, three x264 presets).

## Conventions

All user-facing strings, error messages, code comments, and the README are in Spanish (Rioplatense voseo: "Pegá", "Abrí"). Keep new text consistent.
