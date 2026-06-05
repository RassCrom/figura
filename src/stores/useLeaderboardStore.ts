import { create } from "zustand";
import { persist } from "zustand/middleware";

import { GAME_CONFIG } from "../config/gameConfig";
import type { LeaderboardEntry } from "../types/figure";

type LeaderboardState = {
  entries: LeaderboardEntry[];
  lastEntryId: string | null;
  addEntry: (entry: Omit<LeaderboardEntry, "id" | "date">) => string;
  clearCurrentMarkers: () => void;
};

function sameCategories(left: string[], right: string[]): boolean {
  const normalizedLeft = [...left].sort();
  const normalizedRight = [...right].sort();
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((category, index) => category === normalizedRight[index])
  );
}

export const useLeaderboardStore = create<LeaderboardState>()(
  persist(
    (set, get) => ({
      entries: [],
      lastEntryId: null,
      addEntry: (entry) => {
        const existing = get().entries.find(
          (item) =>
            item.current &&
            item.nickname === entry.nickname &&
            item.score === entry.score &&
            item.difficulty === entry.difficulty &&
            sameCategories(item.categories, entry.categories),
        );

        if (existing) {
          set({ lastEntryId: existing.id });
          return existing.id;
        }

        const id = crypto.randomUUID();
        const datedEntry: LeaderboardEntry = {
          ...entry,
          id,
          date: new Date().toISOString(),
          current: true,
        };

        set((state) => {
          const cleaned = state.entries.map((item) => ({ ...item, current: false }));
          const next = [datedEntry, ...cleaned]
            .sort((a, b) => b.score - a.score)
            .slice(0, GAME_CONFIG.maxLeaderboardEntries);
          return { entries: next, lastEntryId: id };
        });

        return id;
      },
      clearCurrentMarkers: () =>
        set((state) => ({
          entries: state.entries.map((entry) => ({ ...entry, current: false })),
          lastEntryId: null,
        })),
    }),
    {
      name: "gtf_leaderboard",
      version: 1,
    },
  ),
);
