import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  calculateXpAward,
  getLevelInfo,
  resolveAchievementUnlocks,
  type GameProgressSummary,
  type ProfileAward,
} from "../lib/progression";
import type { AchievementId } from "../types/figure";

type ProfileState = {
  xp: number;
  personalBest: number;
  unlockedAchievements: AchievementId[];
  correctEver: boolean;
  scholarWinStreak: number;
  processedSessionIds: string[];
  lastAward: ProfileAward | null;
  recordGame: (summary: GameProgressSummary) => ProfileAward;
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      xp: 0,
      personalBest: 0,
      unlockedAchievements: [],
      correctEver: false,
      scholarWinStreak: 0,
      processedSessionIds: [],
      lastAward: null,
      recordGame: (summary) => {
        const state = get();
        if (state.processedSessionIds.includes(summary.sessionId) && state.lastAward) {
          return state.lastAward;
        }

        const xpAwarded = calculateXpAward(summary.score);
        const winningScholarRun =
          summary.score > 0 && (summary.difficulty === "Scholar" || summary.difficulty === "Conqueror");
        const scholarWinStreak = winningScholarRun ? state.scholarWinStreak + 1 : 0;
        const previousBest = state.personalBest;
        const personalBest = Math.max(previousBest, summary.score);
        const unlockedNow = resolveAchievementUnlocks({
          summary,
          unlocked: state.unlockedAchievements,
          correctEver: state.correctEver,
          scholarWinStreak,
        });
        const unlockedAchievements = [...new Set([...state.unlockedAchievements, ...unlockedNow])];
        const nextXp = state.xp + xpAwarded;
        const levelInfo = getLevelInfo(nextXp);
        const award: ProfileAward = {
          xpAwarded,
          previousBest,
          personalBest,
          bestDelta: summary.score - previousBest,
          unlockedNow,
          levelName: levelInfo.levelName,
          nextLevelName: levelInfo.nextLevelName,
          levelProgress: levelInfo.progress,
        };

        set({
          xp: nextXp,
          personalBest,
          unlockedAchievements,
          correctEver: state.correctEver || summary.results.some((result) => result.correct),
          scholarWinStreak,
          processedSessionIds: [...state.processedSessionIds, summary.sessionId].slice(-25),
          lastAward: award,
        });

        return award;
      },
    }),
    {
      name: "gtf_profile",
      version: 1,
    },
  ),
);
