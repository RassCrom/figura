import { describe, expect, it } from "vitest";

import type { RoundResult } from "../types/figure";
import { getLevelInfo, resolveAchievementUnlocks } from "./progression";

const result: RoundResult = {
  round: 1,
  figureId: "ada-lovelace",
  figureName: "Ada Lovelace",
  score: 5000,
  wrongGuesses: 0,
  hintsUsed: 0,
  timeUsed: 4,
  extraUsed: 0,
  category: "Scientist",
  continent: "Europe",
  correct: true,
  firstGuess: true,
};

describe("progression tiers", () => {
  it("continues the level path beyond Legend", () => {
    expect(getLevelInfo(20_000).levelName).toBe("Pathfinder");
    expect(getLevelInfo(32_000).levelName).toBe("Luminary");
    expect(getLevelInfo(50_000).levelName).toBe("Worldseer");
    expect(getLevelInfo(75_000).levelName).toBe("Immortal");
  });

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

  it("requires a clean first-try round for ice_cold", () => {
    const base = {
      unlocked: [] as never[],
      correctEver: true,
      scholarWinStreak: 0,
      totalGames: 1,
      collectionSize: 1,
      dailyStreak: 0,
      categoryStats: {},
    };

    const dirty = resolveAchievementUnlocks({
      ...base,
      summary: {
        sessionId: "session",
        score: 3800,
        difficulty: "Conqueror",
        results: [{ ...result, wrongGuesses: 1 }],
      },
    });
    expect(dirty).not.toContain("ice_cold");

    const clean = resolveAchievementUnlocks({
      ...base,
      summary: {
        sessionId: "session",
        score: 5000,
        difficulty: "Conqueror",
        results: [result],
      },
    });
    expect(clean).toContain("ice_cold");
  });

  it("keeps Great Khan achievable under the milder score ceiling", () => {
    const unlocked = resolveAchievementUnlocks({
      summary: {
        sessionId: "great-khan",
        score: 27_000,
        difficulty: "Explorer",
        results: [result],
      },
      unlocked: [],
      correctEver: true,
      scholarWinStreak: 0,
      totalGames: 1,
      collectionSize: 1,
      dailyStreak: 0,
      categoryStats: {},
    });

    expect(unlocked).toContain("great_khan");
  });
});
