import { beforeEach, describe, expect, it } from "vitest";

import type { RoundResult } from "../types/figure";
import { useProfileStore } from "./useProfileStore";

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

describe("profile retention state", () => {
  beforeEach(() => {
    useProfileStore.setState({
      xp: 0,
      personalBest: 0,
      unlockedAchievements: [],
      correctEver: false,
      scholarWinStreak: 0,
      dailyStreak: 4,
      lastDailyPlayedOn: "2026-06-08",
      totalGames: 0,
      collectedFigureIds: [],
      categoryStats: {},
      streakFreezeWeek: null,
      streakFreezesUsed: 0,
      processedSessionIds: [],
      lastAward: null,
    });
  });

  it("uses one weekly freeze and records Codex/category progress", async () => {
    await useProfileStore.getState().recordGame(
      {
        sessionId: "daily-freeze",
        score: 5000,
        difficulty: "Scholar",
        results: [result],
      },
      ["Scientist"],
      { mode: "daily", dailyDate: "2026-06-10" },
    );

    const state = useProfileStore.getState();
    expect(state.dailyStreak).toBe(5);
    expect(state.streakFreezesUsed).toBe(1);
    expect(state.collectedFigureIds).toEqual(["ada-lovelace"]);
    expect(state.categoryStats.Scientist).toEqual({ correct: 1, attempts: 1 });
  });
});
