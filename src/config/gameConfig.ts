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
  easyEndpointPopularityRating: 97,
  baseScore: 5000,
  wrongPenalty: 1200,
  timeBonusMax: 800,
  streakBonus: 500,
} as const;

export function calcRoundScore(
  wrong: number,
  timeUsed: number,
  extraUsed: number,
  streak: boolean,
): number {
  const penalty = wrong * GAME_CONFIG.wrongPenalty;
  // timeBonus must clamp at 0. Without the clamp, a player who spilled into
  // the extra-time bank could earn a *negative* time bonus that erased part
  // of their base score — surprising and almost certainly unintentional.
  const timeBonus = Math.max(
    0,
    Math.round(
      (1 - (timeUsed + extraUsed * 0.5) / GAME_CONFIG.roundSeconds) * GAME_CONFIG.timeBonusMax,
    ),
  );
  const streakBonus = streak ? GAME_CONFIG.streakBonus : 0;
  return Math.max(0, GAME_CONFIG.baseScore - penalty + timeBonus + streakBonus);
}
