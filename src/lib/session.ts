import { GAME_CONFIG } from "../config/gameConfig";
import type { Difficulty, Figure } from "../types/figure";
import { getDifficultyPool, getRelaxedPool, shuffle } from "./figures";

export function buildFigureQueue(
  figures: Figure[],
  difficulty: Difficulty,
  selectedCategories: string[],
): { queue: Figure[]; relaxed: boolean } {
  const strictPool = getDifficultyPool(figures, difficulty, selectedCategories);
  const relaxed = strictPool.length < GAME_CONFIG.roundCount;
  const pool = relaxed ? getRelaxedPool(figures, selectedCategories) : strictPool;
  return {
    queue: shuffle(pool).slice(0, GAME_CONFIG.roundCount),
    relaxed,
  };
}
