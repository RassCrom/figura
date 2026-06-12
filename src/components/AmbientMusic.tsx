import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { useSoundManager } from "../hooks/useSoundManager";

export function AmbientMusic() {
  const { pathname } = useLocation();
  const { playLoop, stopLoop } = useSoundManager();
  const isGame = pathname === "/game";

  useEffect(() => {
    if (isGame) {
      stopLoop("menu-ambient");
      return;
    }

    const startMusic = () => playLoop("menu-ambient");
    startMusic();
    window.addEventListener("pointerdown", startMusic, { once: true });
    window.addEventListener("keydown", startMusic, { once: true });

    return () => {
      window.removeEventListener("pointerdown", startMusic);
      window.removeEventListener("keydown", startMusic);
    };
  }, [isGame, playLoop, stopLoop]);

  return null;
}
