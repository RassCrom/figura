import type { AchievementId, Difficulty, PlayerLevel, RoundResult } from "../types/figure";
import { normalizeName } from "./figures";

export type AchievementDefinition = {
  id: AchievementId;
  name: string;
  description: string;
};

export type LevelDefinition = {
  name: PlayerLevel;
  minXp: number;
};

export type GameProgressSummary = {
  sessionId: string;
  score: number;
  difficulty: Difficulty;
  results: RoundResult[];
};

export type ProfileAward = {
  xpAwarded: number;
  previousBest: number;
  personalBest: number;
  bestDelta: number;
  unlockedNow: AchievementId[];
  levelName: PlayerLevel;
  previousLevelName: PlayerLevel;
  leveledUp: boolean;
  nextLevelName: PlayerLevel | null;
  levelProgress: number;
  /** Error code when the run could not be saved to the server (null = saved or offline-only). */
  syncError: string | null;
};

export const LEVELS: LevelDefinition[] = [
  { name: "Traveler", minXp: 0 },
  { name: "Cartographer", minXp: 1000 },
  { name: "Historian", minXp: 3000 },
  { name: "Oracle", minXp: 6500 },
  { name: "Legend", minXp: 12000 },
  { name: "Pathfinder", minXp: 20000 },
  { name: "Luminary", minXp: 32000 },
  { name: "Worldseer", minXp: 50000 },
  { name: "Immortal", minXp: 75000 },
];

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: "first_blood",
    name: "First Blood",
    description: "Land your first correct guess.",
  },
  {
    id: "lightning_round",
    name: "Lightning Round",
    description: "Guess correctly in under 5 seconds.",
  },
  {
    id: "ice_cold",
    name: "Ice Cold",
    description: "Guess with 0 hints on Conqueror difficulty.",
  },
  {
    id: "around_the_world",
    name: "Around the World",
    description: "Guess figures from 5 continents in one session.",
  },
  {
    id: "on_fire",
    name: "On Fire",
    description: "Build a 5-game win streak on Scholar or higher.",
  },
  {
    id: "silk_road",
    name: "Silk Road",
    description: "Guess Genghis Khan and al-Farabi in the same session.",
  },
  {
    id: "great_khan",
    name: "Great Khan",
    description: "Reach 30,000 points in one run.",
  },
  { id: "collector_10", name: "Codex Initiate", description: "Identify 10 unique figures." },
  { id: "collector_50", name: "Codex Curator", description: "Identify 50 unique figures." },
  { id: "collector_100", name: "Codex Keeper", description: "Identify 100 unique figures." },
  { id: "veteran_25", name: "Seasoned Traveler", description: "Complete 25 games." },
  { id: "veteran_100", name: "Century of Runs", description: "Complete 100 games." },
  { id: "daily_7", name: "Seven Suns", description: "Build a 7-day daily streak." },
  { id: "daily_30", name: "Calendar Scholar", description: "Build a 30-day daily streak." },
  {
    id: "category_ace",
    name: "Field Specialist",
    description: "Reach 80% accuracy across 20 attempts in one category.",
  },
];

export function getLevelInfo(xp: number): {
  levelName: PlayerLevel;
  nextLevelName: PlayerLevel | null;
  progress: number;
  currentMin: number;
  nextMin: number | null;
} {
  const current = [...LEVELS].reverse().find((level) => xp >= level.minXp) ?? LEVELS[0];
  const currentIndex = LEVELS.findIndex((level) => level.name === current.name);
  const next = LEVELS[currentIndex + 1] ?? null;

  if (!next) {
    return {
      levelName: current.name,
      nextLevelName: null,
      progress: 1,
      currentMin: current.minXp,
      nextMin: null,
    };
  }

  return {
    levelName: current.name,
    nextLevelName: next.name,
    progress: Math.max(0, Math.min(1, (xp - current.minXp) / (next.minXp - current.minXp))),
    currentMin: current.minXp,
    nextMin: next.minXp,
  };
}

export function calculateXpAward(score: number): number {
  return Math.max(50, Math.round(score / 18));
}

export function resolveAchievementUnlocks(args: {
  summary: GameProgressSummary;
  unlocked: AchievementId[];
  correctEver: boolean;
  scholarWinStreak: number;
  totalGames: number;
  collectionSize: number;
  dailyStreak: number;
  categoryStats: Record<string, { correct: number; attempts: number }>;
}): AchievementId[] {
  const unlocked = new Set(args.unlocked);
  const next: AchievementId[] = [];
  const correctResults = args.summary.results.filter((result) => result.correct);

  function unlock(id: AchievementId, condition: boolean) {
    if (condition && !unlocked.has(id)) {
      next.push(id);
      unlocked.add(id);
    }
  }

  unlock("first_blood", !args.correctEver && correctResults.length > 0);
  unlock(
    "lightning_round",
    correctResults.some((result) => result.timeUsed < 5),
  );
  unlock(
    "ice_cold",
    args.summary.difficulty === "Conqueror" &&
      correctResults.some((result) => result.wrongGuesses === 0 && result.hintsUsed === 0),
  );
  unlock(
    "around_the_world",
    new Set(
      correctResults
        .map((result) => result.continent)
        .filter((continent) => continent !== "Unknown"),
    ).size >= 5,
  );
  unlock("on_fire", args.scholarWinStreak >= 5);

  const names = correctResults.map((result) => normalizeName(result.figureName));
  unlock(
    "silk_road",
    names.some((name) => name.includes("genghis khan")) &&
      names.some((name) => name.includes("al farabi") || name.includes("muhammad al farabi")),
  );
  unlock("great_khan", args.summary.score >= 30000);
  unlock("collector_10", args.collectionSize >= 10);
  unlock("collector_50", args.collectionSize >= 50);
  unlock("collector_100", args.collectionSize >= 100);
  unlock("veteran_25", args.totalGames >= 25);
  unlock("veteran_100", args.totalGames >= 100);
  unlock("daily_7", args.dailyStreak >= 7);
  unlock("daily_30", args.dailyStreak >= 30);
  unlock(
    "category_ace",
    Object.values(args.categoryStats).some(
      (stats) => stats.attempts >= 20 && stats.correct / stats.attempts >= 0.8,
    ),
  );

  return next;
}
