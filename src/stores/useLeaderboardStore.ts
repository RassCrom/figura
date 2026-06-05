import { create } from "zustand";
import { persist } from "zustand/middleware";

import { GAME_CONFIG } from "../config/gameConfig";
import { fetchTopLeaderboard } from "../lib/api";
import type { LeaderboardEntry } from "../types/figure";

type LeaderboardState = {
  entries: LeaderboardEntry[];
  lastEntryId: string | null;
  loading: boolean;
  lastFetchedAt: number;
  refresh: (force?: boolean) => Promise<void>;
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

const REFRESH_INTERVAL_MS = 30_000;

export const useLeaderboardStore = create<LeaderboardState>()(
  persist(
    (set, get) => ({
      entries: [],
      lastEntryId: null,
      loading: false,
      lastFetchedAt: 0,
      refresh: async (force = false) => {
        const now = Date.now();
        if (!force && now - get().lastFetchedAt < REFRESH_INTERVAL_MS) {
          return;
        }
        set({ loading: true });
        const remote = await fetchTopLeaderboard(GAME_CONFIG.maxLeaderboardEntries);
        if (remote.length === 0) {
          set({ loading: false, lastFetchedAt: now });
          return;
        }
        const currentIds = new Set(get().entries.filter((e) => e.current).map((e) => e.id));
        const merged = remote.map((entry) =>
          currentIds.has(entry.id) ? { ...entry, current: true } : entry,
        );
        set({ entries: merged, loading: false, lastFetchedAt: now });
      },
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
      version: 2,
      partialize: (state) => ({
        entries: state.entries,
        lastEntryId: state.lastEntryId,
      }),
    },
  ),
);
