import { ensureAnonymousUser, supabase } from "./supabase";
import { cleanLeaderboardEntries } from "./leaderboard";
import {
  clampPublicLimit,
  isIsoDate,
  isValidPublicNickname,
  nicknameValidationError,
  parseRpcError,
} from "./apiSecurity";
import type {
  AchievementId,
  Difficulty,
  LeaderboardEntry,
  PlayerLevel,
  RoundResult,
} from "../types/figure";

export type ServerProfile = {
  id: string;
  nickname: string | null;
  xp: number;
  personalBest: number;
  unlockedAchievements: AchievementId[];
  correctEver: boolean;
  scholarWinStreak: number;
  dailyStreak: number;
  lastDailyPlayedOn: string | null;
  totalGames: number;
};

export type SubmitRunInput = {
  sessionId: string;
  difficulty: Difficulty;
  categories: string[];
  results: RoundResult[];
  achievements: AchievementId[];
  levelName: PlayerLevel;
  mode?: "classic" | "daily" | "reverse";
  dailyDate?: string;
};

export type SubmitRunResult =
  | { ok: true; runId: string; score: number; xpAwarded: number; idempotent: boolean }
  | { ok: false; error: string };

export type ClaimNicknameResult = { ok: true; nickname: string } | { ok: false; error: string };

type LeaderboardRpcRow = {
  id: string;
  nickname: string;
  score: number;
  difficulty: string;
  categories: string[];
  level_name: string | null;
  achievements: string[] | null;
  created_at: string;
};

function asRows<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

export async function fetchProfile(): Promise<ServerProfile | null> {
  if (!supabase) return null;
  const userId = await ensureAnonymousUser();
  if (!userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, nickname, xp, personal_best, unlocked_achievements, correct_ever, scholar_win_streak, daily_streak, last_daily_played_on, total_games",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    nickname: data.nickname,
    xp: data.xp,
    personalBest: data.personal_best,
    unlockedAchievements: data.unlocked_achievements as AchievementId[],
    correctEver: data.correct_ever,
    scholarWinStreak: data.scholar_win_streak,
    dailyStreak: data.daily_streak,
    lastDailyPlayedOn: data.last_daily_played_on,
    totalGames: data.total_games,
  };
}

export async function claimNickname(nickname: string): Promise<ClaimNicknameResult> {
  if (!supabase) return { ok: false, error: "OFFLINE" };
  const validationError = nicknameValidationError(nickname);
  if (validationError) return { ok: false, error: validationError };
  const userId = await ensureAnonymousUser();
  if (!userId) return { ok: false, error: "AUTH_REQUIRED" };
  const { data, error } = await supabase.rpc("claim_nickname", { p_nickname: nickname });
  if (error) {
    return { ok: false, error: parseRpcError(error.message) };
  }
  const obj = data as { nickname?: string } | null;
  return { ok: true, nickname: obj?.nickname ?? nickname };
}

export async function submitRun(input: SubmitRunInput): Promise<SubmitRunResult> {
  if (!supabase) return { ok: false, error: "OFFLINE" };
  const userId = await ensureAnonymousUser();
  if (!userId) return { ok: false, error: "AUTH_REQUIRED" };

  // The server recomputes every round score from these fields and ignores the
  // client-side `score`; reverse rounds additionally need the distance and
  // year errors. Keep this in sync with the submit_run SQL function.
  const serverResults = input.results.map((result) => ({
    round: result.round,
    figureId: result.figureId,
    figureName: result.figureName,
    score: result.score,
    wrongGuesses: result.wrongGuesses,
    hintsUsed: result.hintsUsed,
    timeUsed: result.timeUsed,
    extraUsed: result.extraUsed,
    category: result.category,
    continent: result.continent,
    correct: result.correct,
    firstGuess: result.firstGuess,
    distanceKm: result.distanceKm,
    birthYearError: result.birthYearError,
    deathYearError: result.deathYearError,
  }));
  const { data, error } = await supabase.rpc("submit_run", {
    p_results: serverResults as unknown as never,
    p_difficulty: input.difficulty,
    p_categories: input.categories,
    p_session_id: input.sessionId,
    p_mode: input.mode ?? "classic",
    p_daily_date: input.dailyDate,
    // Server keeps only the achievements it cannot derive itself and computes
    // the rest from validated data.
    p_achievements: input.achievements,
    p_level_name: input.levelName,
  });

  if (error) {
    return { ok: false, error: parseRpcError(error.message) };
  }
  const obj = data as {
    run_id: string;
    score: number;
    xp_awarded: number;
    idempotent?: boolean;
  } | null;
  if (!obj) {
    return { ok: false, error: "EMPTY_RESPONSE" };
  }
  return {
    ok: true,
    runId: obj.run_id,
    score: obj.score,
    xpAwarded: obj.xp_awarded,
    idempotent: Boolean(obj.idempotent),
  };
}

export async function fetchTopLeaderboard(
  limit = 100,
  difficulty?: Difficulty,
): Promise<LeaderboardEntry[]> {
  if (!supabase) return [];
  const safeLimit = clampPublicLimit(limit);
  const { data, error } = await supabase.rpc("top_leaderboard", {
    p_limit: safeLimit,
    p_difficulty: difficulty,
  });
  if (error || !data) return [];
  const entries = asRows<LeaderboardRpcRow>(data).map(
    (row) =>
      ({
        id: row.id,
        nickname: row.nickname,
        score: row.score,
        difficulty: row.difficulty as Difficulty,
        categories: row.categories,
        levelName: (row.level_name ?? undefined) as PlayerLevel | undefined,
        achievements: (row.achievements ?? []) as AchievementId[],
        date: row.created_at,
      }) satisfies LeaderboardEntry,
  );
  return cleanLeaderboardEntries(entries).slice(0, safeLimit);
}

export type DailyLeaderboardEntry = LeaderboardEntry & { rank: number };

export async function fetchDailyLeaderboard(
  dailyDate: string,
  difficulty?: Difficulty,
  limit = 100,
): Promise<DailyLeaderboardEntry[]> {
  if (!supabase || !isIsoDate(dailyDate)) return [];
  const safeLimit = clampPublicLimit(limit);
  const { data, error } = await supabase.rpc("daily_leaderboard", {
    p_daily_date: dailyDate,
    p_difficulty: difficulty,
    p_limit: safeLimit,
  });
  if (error || !data) return [];
  const entries = asRows<LeaderboardRpcRow>(data).map((row) => ({
    id: row.id,
    rank: 0,
    nickname: row.nickname,
    score: row.score,
    difficulty: row.difficulty as Difficulty,
    categories: row.categories,
    levelName: (row.level_name ?? undefined) as PlayerLevel | undefined,
    achievements: (row.achievements ?? []) as AchievementId[],
    date: row.created_at,
  }));
  return cleanLeaderboardEntries(entries)
    .slice(0, safeLimit)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export async function fetchDailyPercentile(
  dailyDate: string,
  score: number,
): Promise<number | null> {
  if (!supabase || !isIsoDate(dailyDate) || !Number.isFinite(score)) return null;
  const { data, error } = await supabase.rpc("daily_percentile", {
    p_daily_date: dailyDate,
    p_score: Math.trunc(score),
  });
  if (error || data == null) return null;
  const percentile = Number(data);
  return Number.isFinite(percentile) ? percentile : null;
}

export type WeeklyEntry = {
  rank: number;
  nickname: string;
  bestScore: number;
  difficulty: Difficulty;
  levelName: PlayerLevel | null;
  achievements: AchievementId[];
  playedAt: string;
  gamesPlayed: number;
};

export async function fetchWeeklyLeaderboard(limit = 100): Promise<WeeklyEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("weekly_leaderboard", {
    p_limit: clampPublicLimit(limit),
  });
  if (error || !data) return [];
  const rows = data as unknown as Array<{
    rank: number;
    nickname: string;
    best_score: number;
    difficulty: string;
    level_name: string | null;
    achievements: string[] | null;
    played_at: string;
    games_played: number;
  }>;
  return rows.map((row) => ({
    rank: Number(row.rank),
    nickname: row.nickname,
    bestScore: row.best_score,
    difficulty: row.difficulty as Difficulty,
    levelName: (row.level_name ?? null) as PlayerLevel | null,
    achievements: (row.achievements ?? []) as AchievementId[],
    playedAt: row.played_at,
    gamesPlayed: Number(row.games_played),
  }));
}

export type WeeklyArchive = {
  weekStart: string;
  winners: Array<{
    nickname: string;
    bestScore: number;
    difficulty: Difficulty;
    levelName: PlayerLevel | null;
    achievements: AchievementId[];
    playedAt: string;
  }>;
};

export async function fetchHallOfFame(limit = 20): Promise<WeeklyArchive[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("hall_of_fame", {
    p_limit: clampPublicLimit(limit, 52),
  });
  if (error || !data) return [];
  return asRows<{ week_start: string; winners: unknown }>(data).map((row) => {
    const winners =
      (row.winners as unknown as Array<{
        nickname: string;
        best_score: number;
        difficulty: string;
        level_name: string | null;
        achievements: string[] | null;
        played_at: string;
      }>) ?? [];
    return {
      weekStart: row.week_start,
      winners: winners.map((w) => ({
        nickname: w.nickname,
        bestScore: w.best_score,
        difficulty: w.difficulty as Difficulty,
        levelName: (w.level_name ?? null) as PlayerLevel | null,
        achievements: (w.achievements ?? []) as AchievementId[],
        playedAt: w.played_at,
      })),
    };
  });
}

export type PublicProfile = {
  nickname: string;
  xp: number;
  personalBest: number;
  totalGames: number;
  dailyStreak: number;
  achievements: AchievementId[];
  createdAt: string;
  favoriteCategory: string | null;
  bestRuns: Array<{
    score: number;
    difficulty: Difficulty;
    levelName: PlayerLevel | null;
    achievements: AchievementId[];
    categories: string[];
    playedAt: string;
  }>;
  difficultyStats: Record<string, { games: number; wins: number }>;
};

export async function fetchPublicProfile(nickname: string): Promise<PublicProfile | null> {
  if (!supabase || !isValidPublicNickname(nickname)) return null;
  const { data, error } = await supabase.rpc("get_public_profile", { p_nickname: nickname });
  if (error || data == null) return null;
  const obj = data as unknown as {
    nickname: string;
    xp: number;
    personal_best: number;
    total_games: number;
    daily_streak: number;
    achievements: string[];
    created_at: string;
    favorite_category: string | null;
    best_runs: Array<{
      score: number;
      difficulty: string;
      level_name: string | null;
      achievements: string[] | null;
      categories: string[];
      played_at: string;
    }>;
    difficulty_stats: Record<string, { games: number; wins: number }>;
  };
  return {
    nickname: obj.nickname,
    xp: obj.xp,
    personalBest: obj.personal_best,
    totalGames: obj.total_games,
    dailyStreak: obj.daily_streak,
    achievements: obj.achievements as AchievementId[],
    createdAt: obj.created_at,
    favoriteCategory: obj.favorite_category,
    bestRuns: obj.best_runs.map((row) => ({
      score: row.score,
      difficulty: row.difficulty as Difficulty,
      levelName: (row.level_name ?? null) as PlayerLevel | null,
      achievements: (row.achievements ?? []) as AchievementId[],
      categories: row.categories,
      playedAt: row.played_at,
    })),
    difficultyStats: obj.difficulty_stats,
  };
}

export async function fetchPlayersToday(): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase.rpc("players_today");
  if (error || data == null) return 0;
  return Number(data);
}
