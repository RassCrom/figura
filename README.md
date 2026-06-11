# Figura

Figura is a small geography-and-history guessing game. Each round shows a person's life journey on a map, starting at their birthplace and ending at their place of death. The player has to guess the figure before time runs out.

The project is built as a Vite + React app with MapLibre for the maps, Zustand for local state, and optional Supabase sync for nicknames, profiles, and leaderboards.

## What You Can Do

- Play a five-round session with timed guesses and score bonuses.
- Use hints that reveal life dates and places after wrong guesses.
- Play a daily challenge with the same five figures for everyone.
- Browse figure journey pages with birth/death map routes.
- Change difficulty, categories, basemap, music, and sound effects.
- Keep local progress, XP, achievements, and streaks.
- Enable Supabase to sync leaderboard and public profile data.

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- MapLibre GL
- Turf great-circle routes
- Zustand
- Supabase, when configured

## Getting Started

Use pnpm, since the repository is locked with `pnpm-lock.yaml`.

```bash
pnpm install
pnpm run dev
```

The dev server runs on:

```text
http://127.0.0.1:5173/
```

## Environment Variables

The app can run without Supabase. If the variables below are missing or still contain the example values, the game works locally and online sync is skipped.

Create `.env` from `.env.example` when you want backend sync:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

With Supabase configured, the app signs players in anonymously and uses that session for nickname claiming, profile hydration, and leaderboard updates.

## Available Scripts

```bash
pnpm run dev
```

Starts the Vite dev server on `127.0.0.1`.

```bash
pnpm run build
```

Runs TypeScript project checks and creates a production build in `dist/`.

```bash
pnpm run preview
```

Serves the production build locally for a final smoke test.

## Project Structure

```text
src/
  components/     Shared UI pieces
  config/         Game timing and scoring constants
  data/           Figure data used by the game
  hooks/          Small React hooks
  i18n/           UI copy
  lib/            Data loading, scoring helpers, maps, Supabase API calls
  pages/          Route-level screens
  stores/         Zustand stores
  types/          Shared TypeScript types
```

The main route setup lives in `src/App.tsx`. The game surface is `src/pages/GamePage.tsx`, and the shared map rendering logic is in `src/lib/mapEngine.ts`.

## Figure Data

Figures are loaded from `src/data/figures.json`. Generated records include a `source_url` reference,
and the data pipeline rejects duplicate or placeholder identities before they reach the app.
Coordinates are stored as:

```ts
[latitude, longitude]
```

MapLibre expects longitude first, so map code converts them before rendering markers and routes.

Use `pnpm run audit:data` to assess identity, category, chronology, and likely-person duplicates.
Use `pnpm run fix:data` to remove hard reliability failures and standardize category names, then
run `pnpm run prepare:data` to regenerate public records.
Use `pnpm run rebalance:data` to enforce the curated sportsperson roster and remove leaders below
the maintained popularity cutoff.

## Development Notes

- Keep figure data valid. Invalid entries are filtered out during loading.
- The game should remain playable without Supabase credentials.
- Map routes are shared by the game and figure profile pages, so changes in `mapEngine.ts` affect both.
- Build output goes to `dist/` and should not be edited by hand.

## Production Build

```bash
pnpm run build
pnpm run preview
```

Vite may warn about large chunks because MapLibre is a sizeable dependency. That warning does not necessarily mean the build failed.
