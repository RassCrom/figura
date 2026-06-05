import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Basemap, Difficulty } from "../types/figure";

type SettingsState = {
  difficulty: Difficulty;
  selectedCategories: string[];
  basemap: Basemap;
  musicVol: number;
  sfxVol: number;
  setDifficulty: (difficulty: Difficulty) => void;
  setSelectedCategories: (categories: string[]) => void;
  toggleCategory: (category: string) => void;
  setBasemap: (basemap: Basemap) => void;
  setMusicVol: (volume: number) => void;
  setSfxVol: (volume: number) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      difficulty: "Explorer",
      selectedCategories: [],
      basemap: "Steppe",
      musicVol: 45,
      sfxVol: 60,
      setDifficulty: (difficulty) => set({ difficulty }),
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
    }),
    {
      name: "gtf_settings",
      version: 1,
    },
  ),
);
