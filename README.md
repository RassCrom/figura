# Figura

Figura is a free history and geography guessing game.

The main game mode is **Where?**: you see a famous person, estimate when they were born and died, then click their birthplace on the map. There is also a **Who?** mode where you follow a person's life journey and guess their name.

## What is in the game?

- Five-round games with scores, timers, hints, and streaks
- Where? and Who? game modes
- A daily challenge shared by every player
- A birthplace atlas with every figure in the game
- Figure profile pages with life routes
- Difficulty, category, map, music, SFX, and accessibility settings
- Local profiles, XP, achievements, and optional online leaderboards

The home globe uses portrait markers. The birthplace atlas uses MapLibre layers and reveals more figures as you zoom in.

## Run it locally

You need Node.js 22.12 or newer and pnpm.

```bash
pnpm install
pnpm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

The app works without a backend. Supabase is only needed for online nicknames, profiles, and leaderboards.
Apply the tracked Supabase migrations before deploying backend-enabled frontend changes. See
[`SECURITY.md`](SECURITY.md) for the required grants, RLS, and RPC checks.

## Environment variables

Copy `.env.example` to `.env` and add your Supabase project details when you want online features:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Do not commit private service-role keys. The browser app only uses the public anonymous key.

## Useful commands

```bash
pnpm run dev          # start the local app
pnpm run typecheck    # check TypeScript
pnpm run lint         # check code style and common mistakes
pnpm run test         # run unit tests
pnpm run build        # create the production build
pnpm run ci           # run every main check
```

Figure data commands:

```bash
pnpm run prepare:data   # rebuild the public figure index and records
pnpm run check:data     # check that generated data is up to date
pnpm run audit:data     # report figure-data problems
pnpm run fix:data       # fix supported data problems
pnpm run rebalance:data # rebalance the maintained figure pool
```

## Main folders

```text
public/audio/     Music used by the game
public/data/      Generated data loaded by the browser
scripts/          Figure-data tools
src/components/   Reusable UI
src/hooks/        Metadata, sound, and small React helpers
src/lib/          Maps, data loading, scoring, and API helpers
src/pages/        Full app screens
src/stores/       Zustand game and settings state
```

## Figure data

The source dataset is `src/data/figures.json`.

Run `pnpm run prepare:data` after changing it. This creates:

- `public/data/figure-index.json` for quick browsing, search, and the birthplace atlas
- `public/data/featured-figures.json` for the home globe
- one full JSON record per figure in `public/data/figures/`

Coordinates in the data are stored as `[latitude, longitude]`. MapLibre expects `[longitude, latitude]`, so map code swaps them before rendering.

## Maps and performance

- The home globe uses a small set of portrait DOM markers.
- The birthplace atlas uses one GeoJSON source and filters names and points by popularity at each zoom level.
- Gameplay routes are added only when needed.
- The gameplay map does not preserve every rendered frame.
- Hidden home-map animation stops until the page is visible again.

## Music and sound

The menu track is:

```text
public/audio/Where_the_Stone_Sleeps-main_music.mp3
```

The gameplay track is:

```text
public/audio/A_Sweet_Reset-map_msuic.mp3
```

Short tick, wrong-answer, correct-answer, and reveal sounds are generated in the browser with the Web Audio API. Music and SFX volumes can be changed separately in Settings.

## SEO

The app includes:

- description, keyword, canonical, Open Graph, and Twitter tags
- route-specific page titles and descriptions
- Game structured data
- `robots.txt`
- a web app manifest

Set the production domain in your hosting platform so the browser-generated canonical URL and share URLs use the correct address.

## Production

```bash
pnpm run build
pnpm run preview
```

The production files are written to `dist/`. Do not edit that folder by hand.
