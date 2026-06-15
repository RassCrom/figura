import type { LeaderboardEntry } from "../types/figure";

export function cleanLeaderboardEntries<T extends LeaderboardEntry>(entries: T[]): T[] {
  const bestByNicknameMode = new Map<string, T>();

  for (const entry of entries) {
    const key = `${entry.nickname.trim().toLocaleLowerCase()}|${entry.mode ?? ""}`;
    const current = bestByNicknameMode.get(key);
    if (
      !current ||
      entry.score > current.score ||
      (entry.score === current.score && new Date(entry.date) > new Date(current.date))
    ) {
      bestByNicknameMode.set(key, entry);
    }
  }

  return [...bestByNicknameMode.values()].sort(
    (left, right) =>
      right.score - left.score ||
      new Date(left.date).getTime() - new Date(right.date).getTime(),
  );
}
