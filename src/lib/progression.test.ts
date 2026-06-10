import { describe, expect, it } from "vitest";

import type { RoundResult } from "../types/figure";
import { resolveAchievementUnlocks } from "./progression";

const result: RoundResult = {
  round: 1,
  figureId: "ada-lovelace",
  figureName: "Ada Lovelace",
  score: 5000,
  hintsUsed: 0,
  timeUsed: 4,
  category: "Scientist",
  continent: "Europe",
  correct: true,
  firstGuess: true,
};

describe("progression tiers", () => {
  it("unlocks collection, veteran, daily, and category tiers", () => {
    const unlocked = resolveAchievementUnlocks({
      summary: {
        sessionId: "session",
        score: 5000,
        difficulty: "Explorer",
        results: [result],
      },
      unlocked: [],
      correctEver: true,
      scholarWinStreak: 0,
      totalGames: 100,
      collectionSize: 100,
      dailyStreak: 30,
      categoryStats: { Scientist: { correct: 18, attempts: 20 } },
    });

    expect(unlocked).toEqual(
      expect.arrayContaining([
        "collector_10",
        "collector_50",
        "collector_100",
        "veteran_25",
        "veteran_100",
        "daily_7",
        "daily_30",
        "category_ace",
      ]),
    );
  });
});
