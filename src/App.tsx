import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";

import { LoadingScreen } from "./components/LoadingScreen";
import { Toast } from "./components/Toast";
import { getCategories, loadFeaturedFigures, loadFigureIndex } from "./lib/figures";
import { ensureAnonymousUser, isSupabaseConfigured } from "./lib/supabase";
import { useGameStore } from "./stores/useGameStore";
import { useLeaderboardStore } from "./stores/useLeaderboardStore";
import { useProfileStore } from "./stores/useProfileStore";
import { useSettingsStore } from "./stores/useSettingsStore";
import type { FeaturedFigure, FigureIndex } from "./types/figure";

const GamePage = lazy(() => import("./pages/GamePage"));
const DailyChallengePage = lazy(() =>
  import("./pages/DailyChallengePage").then((module) => ({ default: module.DailyChallengePage })),
);
const EndPage = lazy(() =>
  import("./pages/EndPage").then((module) => ({ default: module.EndPage })),
);
const FigureProfilePage = lazy(() =>
  import("./pages/FigureProfilePage").then((module) => ({ default: module.FigureProfilePage })),
);
const HomePage = lazy(() =>
  import("./pages/HomePage").then((module) => ({ default: module.HomePage })),
);
const LeaderboardPage = lazy(() =>
  import("./pages/LeaderboardPage").then((module) => ({ default: module.LeaderboardPage })),
);
const PublicProfilePage = lazy(() =>
  import("./pages/PublicProfilePage").then((module) => ({ default: module.PublicProfilePage })),
);
const MyProfilePage = lazy(() =>
  import("./pages/MyProfilePage").then((module) => ({ default: module.MyProfilePage })),
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })),
);

export function App() {
  const [figureIndex, setFigureIndex] = useState<FigureIndex[] | null>(null);
  const [featuredFigures, setFeaturedFigures] = useState<FeaturedFigure[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const toast = useGameStore((state) => state.toast);
  const setSelectedCategories = useSettingsStore((state) => state.setSelectedCategories);
  const hydrateProfile = useProfileStore((state) => state.hydrateFromServer);
  const refreshLeaderboard = useLeaderboardStore((state) => state.refresh);

  useEffect(() => {
    let mounted = true;
    void Promise.all([loadFigureIndex(), loadFeaturedFigures()]).then(
      ([validFigures, featured]) => {
        if (!mounted) {
          return;
        }
        const nextCategories = getCategories(validFigures);
        setFigureIndex(validFigures);
        setFeaturedFigures(featured);
        setCategories(nextCategories);
        // selectedCategories comes from persisted store; only seed the default
        // on first ever load (when the store is empty). Reading the store value
        // directly inside the callback avoids a stale-closure issue and means
        // we don't need it in the dep array, preventing spurious re-fetches.
        if (useSettingsStore.getState().selectedCategories.length === 0) {
          setSelectedCategories(nextCategories);
        }
      },
    );

    return () => {
      mounted = false;
    };
    // setSelectedCategories is a stable Zustand action reference — this effect
    // should only run once on mount, not on every category-count change.
  }, [setSelectedCategories]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void (async () => {
      const userId = await ensureAnonymousUser();
      if (userId) {
        void hydrateProfile();
        void refreshLeaderboard(true);
      }
    })();
  }, [hydrateProfile, refreshLeaderboard]);

  if (!figureIndex) {
    return <LoadingScreen />;
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                figureIndex={figureIndex}
                featuredFigures={featuredFigures}
                categories={categories}
              />
            }
          />
          <Route path="/settings" element={<SettingsPage categories={categories} />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/daily" element={<DailyChallengePage figureIndex={figureIndex} />} />
          <Route
            path="/figure/today"
            element={<FigureProfilePage figureIndex={figureIndex} mode="today" />}
          />
          <Route
            path="/figure/:slug"
            element={<FigureProfilePage figureIndex={figureIndex} mode="slug" />}
          />
          <Route path="/profile/:nickname" element={<PublicProfilePage />} />
          <Route path="/profile" element={<MyProfilePage figureIndex={figureIndex} />} />
          <Route path="/game" element={<GamePage figureIndex={figureIndex} />} />
          <Route path="/end" element={<EndPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toast message={toast} />
      <Analytics />
    </BrowserRouter>
  );
}
