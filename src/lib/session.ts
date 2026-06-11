import { GAME_CONFIG, getDifficultyRules } from "../config/gameConfig";
import type { Difficulty, FigureIndex } from "../types/figure";
import { getDifficultyPool, getRelaxedPool, shuffle } from "./figures";

function figureId(figure: FigureIndex): string {
  return figure.id;
}

function uniqueFigures(figures: FigureIndex[]): FigureIndex[] {
  const seen = new Set<string>();
  return figures.filter((figure) => {
    const id = figureId(figure);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

// Shuffle that floats figures the player hasn't seen recently to the front.
// Recent figures stay in the pool as a fallback so small pools still fill.
function freshFirst(pool: FigureIndex[], recentIds?: ReadonlySet<string>): FigureIndex[] {
  if (!recentIds || recentIds.size === 0) {
    return shuffle(pool);
  }
  const fresh = pool.filter((figure) => !recentIds.has(figureId(figure)));
  const recent = pool.filter((figure) => recentIds.has(figureId(figure)));
  return [...shuffle(fresh), ...shuffle(recent)];
}

function getEasyEndpoints(
  figures: FigureIndex[],
  selectedCategories: string[],
  recentIds?: ReadonlySet<string>,
): FigureIndex[] {
  const easyFigures = figures.filter(
    (figure) => figure.popularity_rating >= GAME_CONFIG.easyEndpointPopularityRating,
  );
  const selectedEasyFigures = easyFigures.filter((figure) =>
    selectedCategories.includes(figure.category),
  );

  return uniqueFigures([
    ...freshFirst(selectedEasyFigures, recentIds),
    ...freshFirst(easyFigures, recentIds),
  ]).slice(0, 2);
}

export function buildFigureQueue(
  figures: FigureIndex[],
  difficulty: Difficulty,
  selectedCategories: string[],
  recentIds?: ReadonlySet<string>,
): { queue: FigureIndex[]; relaxed: boolean } {
  const rules = getDifficultyRules(difficulty);
  if (!rules.easyEndpoints) {
    const strictPool = getDifficultyPool(figures, difficulty, selectedCategories);
    const relaxed = strictPool.length < GAME_CONFIG.roundCount;
    const preferred = relaxed ? getRelaxedPool(figures, selectedCategories) : strictPool;
    return {
      queue: uniqueFigures([
        ...freshFirst(preferred, recentIds),
        ...freshFirst(figures, recentIds),
      ]).slice(0, GAME_CONFIG.roundCount),
      relaxed,
    };
  }
  const middleRoundCount = Math.max(0, GAME_CONFIG.roundCount - 2);
  const endpoints = getEasyEndpoints(figures, selectedCategories, recentIds);
  const endpointIds = new Set(endpoints.map(figureId));
  const strictPool = getDifficultyPool(figures, difficulty, selectedCategories);
  const strictMiddlePool = strictPool.filter((figure) => !endpointIds.has(figureId(figure)));
  const relaxed = strictMiddlePool.length < middleRoundCount;
  const preferredMiddlePool = relaxed
    ? getRelaxedPool(figures, selectedCategories).filter(
        (figure) => !endpointIds.has(figureId(figure)),
      )
    : strictMiddlePool;
  const fallbackMiddlePool = figures.filter((figure) => !endpointIds.has(figureId(figure)));
  const middle = uniqueFigures([
    ...freshFirst(preferredMiddlePool, recentIds),
    ...freshFirst(fallbackMiddlePool, recentIds),
  ]).slice(0, middleRoundCount);

  const queue =
    endpoints.length === 2
      ? [endpoints[0], ...middle, endpoints[1]]
      : uniqueFigures([...endpoints, ...middle]).slice(0, GAME_CONFIG.roundCount);

  return {
    queue,
    relaxed,
  };
}
