import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  calculateXpAward,
  getLevelInfo,
  resolveAchievementUnlocks,
  type GameProgressSummary,
  type ProfileAward,
} from "../lib/progression";
import { fetchProfile, submitRun, type ServerProfile } from "../lib/api";
import type { AchievementId } from "../types/figure";

type ProfileState = {
  xp: number;
  personalBest: number;
  unlockedAchievements: AchievementId[];
  correctEver: boolean;
  scholarWinStreak: number;
  dailyStreak: number;
  lastDailyPlayedOn: string | null;
  totalGames: number;
  processedSessionIds: string[];
  lastAward: ProfileAward | null;
  hydrated: boolean;
  hydrateFromServer: () => Promise<void>;
  recordGame: (
    summary: GameProgressSummary,
    categories: string[],
    options?: { mode?: "classic" | "daily"; dailyDate?: string },
  ) => Promise<ProfileAward>;
};

function applyServerProfile(state: ProfileState, profile: ServerProfile): Partial<ProfileState> {
  return {
    xp: Math.max(state.xp, profile.xp),
    personalBest: Math.max(state.personalBest, profile.personalBest),
    unlockedAchievements: Array.from(
      new Set<AchievementId>([...state.unlockedAchievements, ...profile.unlockedAchievements]),
    ),
    correctEver: state.correctEver || profile.correctEver,
    scholarWinStreak: Math.max(state.scholarWinStreak, profile.scholarWinStreak),
    dailyStreak: Math.max(state.dailyStreak, profile.dailyStreak),
    lastDailyPlayedOn: profile.lastDailyPlayedOn ?? state.lastDailyPlayedOn,
    totalGames: Math.max(state.totalGames, profile.totalGames),
    hydrated: true,
  };
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      xp: 0,
      personalBest: 0,
      unlockedAchievements: [],
      correctEver: false,
      scholarWinStreak: 0,
      dailyStreak: 0,
      lastDailyPlayedOn: null,
      totalGames: 0,
      processedSessionIds: [],
      lastAward: null,
      hydrated: false,
      hydrateFromServer: async () => {
        const profile = await fetchProfile();
        if (!profile) {
          set({ hydrated: true });
          return;
        }
        set((state) => applyServerProfile(state, profile));
      },
      recordGame: async (summary, categories, options) => {
        const state = get();
        if (state.processedSessionIds.includes(summary.sessionId) && state.lastAward) {
          return state.lastAward;
        }
        const mode = options?.mode ?? "classic";
        const dailyDate = options?.dailyDate;

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

        // Local daily streak update — mirrors server logic. If the server submit
        // succeeds, the next hydrateFromServer call will reconcile to authority.
        let nextDailyStreak = state.dailyStreak;
        let nextLastDaily = state.lastDailyPlayedOn;
        if (mode === "daily" && dailyDate && dailyDate !== state.lastDailyPlayedOn) {
          const prevDate = new Date(`${dailyDate}T00:00:00Z`);
          prevDate.setUTCDate(prevDate.getUTCDate() - 1);
          const yesterdayISO = prevDate.toISOString().slice(0, 10);
          nextDailyStreak = state.lastDailyPlayedOn === yesterdayISO ? state.dailyStreak + 1 : 1;
          nextLastDaily = dailyDate;
        }

        set({
          xp: nextXp,
          personalBest,
          unlockedAchievements,
          correctEver: state.correctEver || summary.results.some((result) => result.correct),
          scholarWinStreak,
          dailyStreak: nextDailyStreak,
          lastDailyPlayedOn: nextLastDaily,
          totalGames: state.totalGames + 1,
          processedSessionIds: [...state.processedSessionIds, summary.sessionId].slice(-50),
          lastAward: award,
        });

        // Mirror to server. We use the local award for immediate UI, but the
        // server is the source of truth for leaderboard rank and XP.
        const result = await submitRun({
          sessionId: summary.sessionId,
          score: summary.score,
          difficulty: summary.difficulty,
          categories,
          results: summary.results,
          achievements: unlockedAchievements,
          levelName: levelInfo.levelName,
          mode,
          dailyDate,
        });

        if (result.ok) {
          // Server may have computed a different score (clamped) — reconcile.
          if (result.score !== summary.score) {
            set({ personalBest: Math.max(state.personalBest, result.score) });
          }
        } else if (
          result.error !== "OFFLINE" &&
          result.error !== "RATE_LIMIT" &&
          result.error !== "AUTH_REQUIRED"
        ) {
          console.warn("[profile] submit_run rejected:", result.error);
        }

        return award;
      },
    }),
    {
      name: "gtf_profile",
      version: 2,
      partialize: (state) => ({
        xp: state.xp,
        personalBest: state.personalBest,
        unlockedAchievements: state.unlockedAchievements,
        correctEver: state.correctEver,
        scholarWinStreak: state.scholarWinStreak,
        dailyStreak: state.dailyStreak,
        lastDailyPlayedOn: state.lastDailyPlayedOn,
        totalGames: state.totalGames,
        processedSessionIds: state.processedSessionIds,
        lastAward: state.lastAward,
      }),
    },
  ),
);
