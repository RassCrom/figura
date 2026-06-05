export const GAME_CONFIG = {
  roundCount: 5,
  roundSeconds: 30,
  extraBankSeconds: 30,
  maxSuggestions: 3,
  maxLeaderboardEntries: 100,
  leaderboardPageSize: 10,
  revealAutoDismissMs: 7000,
  debounceMs: 300,
  countdownMs: 900,
  baseScore: 5000,
  wrongPenalty: 1200,
  timeBonusMax: 800,
  streakBonus: 500,
} as const;

export function calcRoundScore(wrong: number, timeUsed: number, extraUsed: number, streak: boolean): number {
  const penalty = wrong * GAME_CONFIG.wrongPenalty;
  const timeBonus = Math.round(
    (1 - (timeUsed + extraUsed * 0.5) / GAME_CONFIG.roundSeconds) * GAME_CONFIG.timeBonusMax,
  );
  const streakBonus = streak ? GAME_CONFIG.streakBonus : 0;
  return Math.max(0, GAME_CONFIG.baseScore - penalty + timeBonus + streakBonus);
}
