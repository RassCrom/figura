import type { Figure, FigureIndex } from "../types/figure";
import { GAME_CONFIG } from "../config/gameConfig";
import { figureMatchesDifficulty, getFullName, normalizeName } from "./figures";

// All players, everywhere, share the same daily set. We key on UTC date so
// the rollover is simultaneous worldwide.
export const DAILY_ROUNDS = 5;

// Day 1 of the daily challenge. Used for "Day N" labels in the share card.
// Update this when launching, then never change it.
export const DAILY_LAUNCH_ISO = "2026-06-04";

export function getUtcDateString(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getDayNumber(dateString: string = getUtcDateString()): number {
  const launch = Date.UTC(
    Number(DAILY_LAUNCH_ISO.slice(0, 4)),
    Number(DAILY_LAUNCH_ISO.slice(5, 7)) - 1,
    Number(DAILY_LAUNCH_ISO.slice(8, 10)),
  );
  const target = Date.UTC(
    Number(dateString.slice(0, 4)),
    Number(dateString.slice(5, 7)) - 1,
    Number(dateString.slice(8, 10)),
  );
  return Math.max(1, Math.round((target - launch) / 86_400_000) + 1);
}

// FNV-1a 32-bit hash — deterministic, fast, no deps.
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// Mulberry32 PRNG. Same seed → same sequence on every device.
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const rand = mulberry32(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// The daily run is recorded as a Scholar-difficulty game, so its pool must
// match the Scholar band: middle rounds come from the Scholar popularity
// range and the two bookends from the easy-endpoint tier — the same shape a
// classic Scholar session has. Drawing from a wider band here would make the
// "Scholar" label (and Scholar leaderboard filters) dishonest.
function getDailyPool<T extends FigureIndex>(figures: T[]): T[] {
  return figures.filter(
    (figure) =>
      figureMatchesDifficulty(figure, "Scholar") ||
      figure.popularity_rating >= GAME_CONFIG.easyEndpointPopularityRating,
  );
}

export function getDailyFigures(
  figures: FigureIndex[],
  dateString: string = getUtcDateString(),
): FigureIndex[] {
  const pool = getDailyPool(figures);
  if (pool.length === 0) {
    return [];
  }
  const seed = fnv1a(`daily:${dateString}`);
  const shuffled = seededShuffle(pool, seed);
  const endpoints = shuffled.filter(
    (figure) => figure.popularity_rating >= GAME_CONFIG.easyEndpointPopularityRating,
  );
  if (endpoints.length < 2) {
    return shuffled.slice(0, DAILY_ROUNDS);
  }

  const endpointIds = new Set(endpoints.slice(0, 2).map((figure) => getFullName(figure)));
  // Middle rounds draw only from the Scholar band, mirroring the classic
  // Scholar queue; bookend-tier figures never appear mid-session.
  const middlePool = shuffled.filter(
    (figure) =>
      figureMatchesDifficulty(figure, "Scholar") && !endpointIds.has(getFullName(figure)),
  );
  const middle = (middlePool.length >= DAILY_ROUNDS - 2 ? middlePool : shuffled).filter(
    (figure) => !endpointIds.has(getFullName(figure)),
  );
  return [endpoints[0], ...middle.slice(0, DAILY_ROUNDS - 2), endpoints[1]];
}

export function getFigureOfTheDay(
  figures: FigureIndex[],
  dateString: string = getUtcDateString(),
): FigureIndex | null {
  const daily = getDailyFigures(figures, dateString);
  return daily[0] ?? null;
}

export function getFigureSlug(figure: Pick<Figure, "first_name" | "last_name">): string {
  return normalizeName(getFullName(figure)).replace(/\s+/g, "-");
}

export function findFigureBySlug(figures: FigureIndex[], slug: string): FigureIndex | null {
  const normalized = slug.toLowerCase();
  return figures.find((figure) => getFigureSlug(figure) === normalized) ?? null;
}

// Time until the next UTC midnight, as "Hh Mm".
export function timeUntilNextDaily(now: Date = new Date()): string {
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0),
  );
  const diffMs = next.getTime() - now.getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}
