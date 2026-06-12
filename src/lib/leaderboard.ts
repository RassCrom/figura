import type { LeaderboardEntry } from "../types/figure";

export function cleanLeaderboardEntries<T extends LeaderboardEntry>(entries: T[]): T[] {
  const bestByNickname = new Map<string, T>();

  for (const entry of entries) {
    const key = entry.nickname.trim().toLocaleLowerCase();
    const current = bestByNickname.get(key);
    if (
      !current ||
      entry.score > current.score ||
      (entry.score === current.score && new Date(entry.date) > new Date(current.date))
    ) {
      bestByNickname.set(key, entry);
    }
  }

  return [...bestByNickname.values()].sort(
    (left, right) =>
      right.score - left.score ||
      new Date(left.date).getTime() - new Date(right.date).getTime(),
  );
}
