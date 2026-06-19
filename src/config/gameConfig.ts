import type { Difficulty } from "../types/figure";

export const GAME_CONFIG = {
  roundCount: 5,
  roundSeconds: 30,
  extraBankSeconds: 30,
  maxSuggestions: 5,
  maxLeaderboardEntries: 100,
  leaderboardPageSize: 10,
  revealAutoDismissMs: 7000,
  debounceMs: 300,
  countdownMs: 900,
  easyEndpointPopularityRating: 98,
  baseScore: 5000,
  wrongPenalty: 1200,
  timeBonusMax: 800,
  streakBonus: 500,
} as const;

export const REVERSE_SCORING = {
  locationPoints: 4600,
  speedPoints: 400,
  perfectRadiusKm: 2,
  distanceDecayKm: 750,
  maxScoringDistanceKm: 5000,
  // A reverse round counts as a "correct" identification (Codex, accuracy
  // stats, continents) only when the pin lands within this radius.
  correctRadiusKm: 2,
} as const;

export type ReverseScoreBreakdown = {
  total: number;
  location: number;
  speed: number;
};

export type DifficultyRules = {
  roundSeconds: number;
  extraBankSeconds: number;
  maxHints: number;
  suggestions: boolean;
  easyEndpoints: boolean;
  suggestionMetadata: boolean;
  reverseDatesRequired: boolean;
};

export const DIFFICULTY_RULES: Record<Difficulty, DifficultyRules> = {
  Explorer: {
    roundSeconds: 30,
    extraBankSeconds: 30,
    maxHints: 3,
    suggestions: true,
    easyEndpoints: true,
    suggestionMetadata: true,
    reverseDatesRequired: false,
  },
  Scholar: {
    roundSeconds: 24,
    extraBankSeconds: 15,
    maxHints: 2,
    suggestions: true,
    easyEndpoints: true,
    suggestionMetadata: false,
    reverseDatesRequired: true,
  },
  Conqueror: {
    roundSeconds: 18,
    extraBankSeconds: 0,
    maxHints: 1,
    suggestions: false,
    easyEndpoints: false,
    suggestionMetadata: false,
    reverseDatesRequired: true,
  },
};

export function getDifficultyRules(difficulty: Difficulty): DifficultyRules {
  return DIFFICULTY_RULES[difficulty];
}

export function calcRoundScore(
  wrong: number,
  timeUsed: number,
  extraUsed: number,
  streak: boolean,
  roundSeconds: number = GAME_CONFIG.roundSeconds,
): number {
  const penalty = wrong * GAME_CONFIG.wrongPenalty;
  // timeBonus must clamp at 0. Without the clamp, a player who spilled into
  // the extra-time bank could earn a *negative* time bonus that erased part
  // of their base score — surprising and almost certainly unintentional.
  const timeBonus = Math.max(
    0,
    Math.round((1 - (timeUsed + extraUsed * 0.5) / roundSeconds) * GAME_CONFIG.timeBonusMax),
  );
  const streakBonus = streak ? GAME_CONFIG.streakBonus : 0;
  return Math.max(0, GAME_CONFIG.baseScore - penalty + timeBonus + streakBonus);
}

export function calcReverseScore(
  distance: number,
  timeUsed: number,
  roundSeconds: number = GAME_CONFIG.roundSeconds,
): ReverseScoreBreakdown {
  const safeDistance = Number.isFinite(distance)
    ? Math.max(0, distance)
    : REVERSE_SCORING.maxScoringDistanceKm;
  if (safeDistance >= REVERSE_SCORING.maxScoringDistanceKm) {
    return { total: 0, location: 0, speed: 0 };
  }
  const scoringDistance = Math.max(0, safeDistance - REVERSE_SCORING.perfectRadiusKm);
  const location = Math.round(
    REVERSE_SCORING.locationPoints *
      Math.exp(-scoringDistance / REVERSE_SCORING.distanceDecayKm),
  );
  const speed = Math.round(
    REVERSE_SCORING.speedPoints *
      Math.max(0, Math.min(1, 1 - Math.max(0, timeUsed) / roundSeconds)),
  );

  return {
    total: location + speed,
    location,
    speed,
  };
}
