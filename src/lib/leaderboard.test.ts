import { describe, expect, it } from "vitest";

import type { LeaderboardEntry } from "../types/figure";
import { cleanLeaderboardEntries } from "./leaderboard";

function entry(
  id: string,
  nickname: string,
  score: number,
  date = "2026-06-01T00:00:00.000Z",
): LeaderboardEntry {
  return {
    id,
    nickname,
    score,
    difficulty: "Explorer",
    categories: ["Scientist"],
    date,
  };
}

describe("leaderboard cleanup", () => {
  it("keeps only each player's best run and ranks by score", () => {
    const cleaned = cleanLeaderboardEntries([
      entry("old", "Ada", 1000),
      entry("best", "ada", 5000),
      entry("other", "Grace", 3000),
    ]);

    expect(cleaned.map((item) => item.id)).toEqual(["best", "other"]);
  });

  it("keeps the newest run when a player's best scores are tied", () => {
    const cleaned = cleanLeaderboardEntries([
      entry("old", "Ada", 5000, "2026-06-01T00:00:00.000Z"),
      entry("new", "Ada", 5000, "2026-06-02T00:00:00.000Z"),
    ]);

    expect(cleaned[0].id).toBe("new");
  });
});
