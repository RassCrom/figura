import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Basemap, Difficulty, GameMode } from "../types/figure";

type SettingsState = {
  difficulty: Difficulty;
  gameMode: Exclude<GameMode, "daily">;
  selectedCategories: string[];
  basemap: Basemap;
  musicVol: number;
  sfxVol: number;
  showSuggestions: boolean;
  showReverseDates: boolean;
  autoAdvanceReveal: boolean;
  reducedMotion: boolean;
  mapTextures: boolean;
  setDifficulty: (difficulty: Difficulty) => void;
  setGameMode: (gameMode: Exclude<GameMode, "daily">) => void;
  setSelectedCategories: (categories: string[]) => void;
  toggleCategory: (category: string) => void;
  setBasemap: (basemap: Basemap) => void;
  setMusicVol: (volume: number) => void;
  setSfxVol: (volume: number) => void;
  setShowSuggestions: (enabled: boolean) => void;
  setShowReverseDates: (enabled: boolean) => void;
  setAutoAdvanceReveal: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
  setMapTextures: (enabled: boolean) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      difficulty: "Explorer",
      gameMode: "reverse",
      selectedCategories: [],
      basemap: "Medivial",
      musicVol: 45,
      sfxVol: 60,
      showSuggestions: true,
      showReverseDates: false,
      autoAdvanceReveal: true,
      reducedMotion: false,
      mapTextures: true,
      setDifficulty: (difficulty) => set({ difficulty }),
      setGameMode: (gameMode) => set({ gameMode }),
      setSelectedCategories: (selectedCategories) => set({ selectedCategories }),
      toggleCategory: (category) =>
        set((state) => {
          const next = state.selectedCategories.includes(category)
            ? state.selectedCategories.filter((item) => item !== category)
            : [...state.selectedCategories, category];

          return { selectedCategories: next.length > 0 ? next : state.selectedCategories };
        }),
      setBasemap: (basemap) => set({ basemap }),
      setMusicVol: (musicVol) => set({ musicVol }),
      setSfxVol: (sfxVol) => set({ sfxVol }),
      setShowSuggestions: (showSuggestions) => set({ showSuggestions }),
      setShowReverseDates: (showReverseDates) => set({ showReverseDates }),
      setAutoAdvanceReveal: (autoAdvanceReveal) => set({ autoAdvanceReveal }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setMapTextures: (mapTextures) => set({ mapTextures }),
    }),
    {
      name: "gtf_settings",
      version: 6,
      migrate: (persistedState) => ({
        ...(persistedState as SettingsState),
        gameMode: "reverse",
        showReverseDates: false,
        basemap: "Medivial",
      }),
    },
  ),
);
