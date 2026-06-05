import type { Figure } from "../types/figure";
import { GAME_CONFIG } from "../config/gameConfig";
import { getFullName, normalizeName } from "./figures";

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

// Daily pool excludes the longest tail of obscure figures to keep the shared
// experience approachable.
function getDailyPool(figures: Figure[]): Figure[] {
  return figures.filter((figure) => figure.popularity_rating >= 70);
}

export function getDailyFigures(
  figures: Figure[],
  dateString: string = getUtcDateString(),
): Figure[] {
  const pool = getDailyPool(figures);
  if (pool.length === 0) {
    return [];
  }
  const seed = fnv1a(`daily:${dateString}`);
  const shuffled = seededShuffle(pool, seed);
  const anchorIndex = shuffled.findIndex(
    (figure) => figure.popularity_rating >= GAME_CONFIG.anchorPopularityRating,
  );
  if (anchorIndex <= 0) {
    return shuffled.slice(0, DAILY_ROUNDS);
  }
  const anchor = shuffled[anchorIndex];
  return [anchor, ...shuffled.slice(0, anchorIndex), ...shuffled.slice(anchorIndex + 1)].slice(
    0,
    DAILY_ROUNDS,
  );
}

export function getFigureOfTheDay(
  figures: Figure[],
  dateString: string = getUtcDateString(),
): Figure | null {
  const daily = getDailyFigures(figures, dateString);
  return daily[0] ?? null;
}

export function getFigureSlug(figure: Figure): string {
  return normalizeName(getFullName(figure)).replace(/\s+/g, "-");
}

export function findFigureBySlug(figures: Figure[], slug: string): Figure | null {
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
