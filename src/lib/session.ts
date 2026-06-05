import { GAME_CONFIG } from "../config/gameConfig";
import type { Difficulty, Figure } from "../types/figure";
import { getDifficultyPool, getFullName, getRelaxedPool, shuffle } from "./figures";

function figureId(figure: Figure): string {
  return getFullName(figure).toLowerCase();
}

function getAnchorFigure(figures: Figure[], selectedCategories: string[]): Figure | null {
  const categoryPool = figures.filter((figure) => selectedCategories.includes(figure.category));
  const anchorPool = categoryPool.filter(
    (figure) => figure.popularity_rating >= GAME_CONFIG.anchorPopularityRating,
  );
  return shuffle(anchorPool)[0] ?? null;
}

export function buildFigureQueue(
  figures: Figure[],
  difficulty: Difficulty,
  selectedCategories: string[],
): { queue: Figure[]; relaxed: boolean } {
  const strictPool = getDifficultyPool(figures, difficulty, selectedCategories);
  const relaxed = strictPool.length < GAME_CONFIG.roundCount;
  const pool = relaxed ? getRelaxedPool(figures, selectedCategories) : strictPool;
  const anchor = getAnchorFigure(figures, selectedCategories);
  const anchorId = anchor ? figureId(anchor) : null;
  const shuffledPool = shuffle(pool).filter((figure) => figureId(figure) !== anchorId);
  const queue = anchor
    ? [anchor, ...shuffledPool].slice(0, GAME_CONFIG.roundCount)
    : shuffledPool.slice(0, GAME_CONFIG.roundCount);

  return {
    queue,
    relaxed,
  };
}
