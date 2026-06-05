import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { LoadingScreen } from "./components/LoadingScreen";
import { Toast } from "./components/Toast";
import { getCategories, loadFigures } from "./lib/figures";
import { useGameStore } from "./stores/useGameStore";
import { useSettingsStore } from "./stores/useSettingsStore";
import type { Figure } from "./types/figure";
import { EndPage } from "./pages/EndPage";
import { HomePage } from "./pages/HomePage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { SettingsPage } from "./pages/SettingsPage";

const GamePage = lazy(() => import("./pages/GamePage"));

export function App() {
  const [figures, setFigures] = useState<Figure[] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const toast = useGameStore((state) => state.toast);
  const setSelectedCategories = useSettingsStore((state) => state.setSelectedCategories);
  const selectedCategories = useSettingsStore((state) => state.selectedCategories);

  useEffect(() => {
    let mounted = true;
    void loadFigures().then((validFigures) => {
      if (!mounted) {
        return;
      }
      const nextCategories = getCategories(validFigures);
      setFigures(validFigures);
      setCategories(nextCategories);
      if (selectedCategories.length === 0) {
        setSelectedCategories(nextCategories);
      }
    });

    return () => {
      mounted = false;
    };
  }, [selectedCategories.length, setSelectedCategories]);

  if (!figures) {
    return <LoadingScreen />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage figures={figures} categories={categories} />} />
        <Route path="/settings" element={<SettingsPage categories={categories} />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route
          path="/game"
          element={
            <Suspense fallback={<LoadingScreen />}>
              <GamePage figures={figures} />
            </Suspense>
          }
        />
        <Route path="/end" element={<EndPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toast message={toast} />
    </BrowserRouter>
  );
}
