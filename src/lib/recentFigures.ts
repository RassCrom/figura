// Remembers the figures from the player's last few sessions so freshly built
// queues prefer figures the player hasn't just seen. Purely a bias: when a
// pool is too small to avoid repeats, recent figures are still used.
const STORAGE_KEY = "gtf_recent_figures";
const MAX_RECENT = 40;

export function getRecentFigureIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

export function recordRecentFigures(ids: string[]): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const previous: unknown = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(previous)
      ? previous.filter((id): id is string => typeof id === "string")
      : [];
    const next = [...new Set([...list, ...ids])].slice(-MAX_RECENT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode, quota) — repeats are acceptable.
  }
}
