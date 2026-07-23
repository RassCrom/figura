import type { Difficulty, GameMode, RoundResult } from "../types/figure";

export type ShareSource = "result" | "threads" | "x" | "whatsapp";

export type RunShareDetails = {
  origin: string;
  mode: GameMode;
  difficulty: Difficulty;
  dayNumber: number | null;
  score: number;
  rank: string;
  results: RoundResult[];
};

export type FriendChallenge = {
  score: number;
  mode: Exclude<GameMode, "daily">;
  difficulty: Difficulty;
};

export type RunStats = {
  solved: number;
  firstTry: number;
  total: number;
  bestRoundScore: number;
};

const DIFFICULTIES: readonly Difficulty[] = ["Explorer", "Scholar", "Conqueror"];
const CHALLENGE_MODES: readonly FriendChallenge["mode"][] = ["classic", "reverse"];

export function getRunStats(results: RoundResult[]): RunStats {
  return {
    solved: results.filter((result) => result.correct).length,
    firstTry: results.filter((result) => result.firstGuess).length,
    total: results.length,
    bestRoundScore: results.reduce((best, result) => Math.max(best, result.score), 0),
  };
}

export function resultTile(result: RoundResult): string {
  if (!result.correct) return "⬛";
  return result.firstGuess ? "🟨" : "🟩";
}

export function buildChallengeUrl(
  details: Pick<RunShareDetails, "origin" | "mode" | "difficulty" | "score">,
  source: ShareSource = "result",
): string {
  const url = new URL(details.mode === "daily" ? "/daily" : "/", details.origin);
  url.searchParams.set("ref", source);

  if (details.mode !== "daily") {
    url.searchParams.set("challenge", String(Math.max(0, Math.round(details.score))));
    url.searchParams.set("mode", details.mode);
    url.searchParams.set("difficulty", details.difficulty);
  }

  return url.toString();
}

export function buildShareText(details: RunShareDetails, source: ShareSource = "result"): string {
  const stats = getRunStats(details.results);
  const title =
    details.mode === "daily" && details.dayNumber ? `FIGURA Daily #${details.dayNumber}` : "FIGURA";
  const grid = details.results.map(resultTile).join("");
  const challengeUrl = buildChallengeUrl(details, source);

  return [
    `${title} ${stats.solved}/${stats.total}`,
    grid,
    `${details.score.toLocaleString()} pts · ${details.rank}`,
    "Can you beat my journey?",
    challengeUrl,
  ].join("\n");
}

export function buildSocialShareUrls(details: RunShareDetails): {
  threads: string;
  x: string;
  whatsapp: string;
} {
  const threadsText = buildShareText(details, "threads");
  const xText = buildShareText(details, "x");
  const whatsappText = buildShareText(details, "whatsapp");

  return {
    threads: `https://www.threads.net/intent/post?text=${encodeURIComponent(threadsText)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(xText)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(whatsappText)}`,
  };
}

export function parseFriendChallenge(searchParams: URLSearchParams): FriendChallenge | null {
  const score = Number(searchParams.get("challenge"));
  const mode = searchParams.get("mode");
  const difficulty = searchParams.get("difficulty");

  if (
    !Number.isFinite(score) ||
    score < 0 ||
    !CHALLENGE_MODES.includes(mode as FriendChallenge["mode"]) ||
    !DIFFICULTIES.includes(difficulty as Difficulty)
  ) {
    return null;
  }

  return {
    score: Math.round(score),
    mode: mode as FriendChallenge["mode"],
    difficulty: difficulty as Difficulty,
  };
}
