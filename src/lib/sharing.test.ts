import { describe, expect, it } from "vitest";

import {
  buildChallengeUrl,
  buildShareText,
  getRunStats,
  parseFriendChallenge,
  resultTile,
} from "./sharing";
import type { RoundResult } from "../types/figure";

function result(overrides: Partial<RoundResult> = {}): RoundResult {
  return {
    round: 1,
    figureId: "figure-1",
    figureName: "Figure One",
    score: 4200,
    wrongGuesses: 0,
    hintsUsed: 0,
    timeUsed: 8,
    extraUsed: 0,
    category: "History",
    continent: "Asia",
    correct: true,
    firstGuess: true,
    ...overrides,
  };
}

describe("result sharing", () => {
  it("uses a spoiler-free Wordle-style tile row", () => {
    expect(resultTile(result())).toBe("🟨");
    expect(resultTile(result({ firstGuess: false }))).toBe("🟩");
    expect(resultTile(result({ correct: false, firstGuess: false }))).toBe("⬛");
  });

  it("summarizes solved, first-try, and best-round performance", () => {
    expect(
      getRunStats([
        result(),
        result({ round: 2, firstGuess: false, score: 3000 }),
        result({ round: 3, correct: false, firstGuess: false, score: 0 }),
      ]),
    ).toEqual({ solved: 2, firstTry: 1, total: 3, bestRoundScore: 4200 });
  });

  it("builds a replayable friend challenge without figure names", () => {
    const results = [
      result(),
      result({ round: 2, figureName: "Secret Figure", firstGuess: false }),
    ];
    const text = buildShareText({
      origin: "https://figura.example",
      mode: "reverse",
      difficulty: "Scholar",
      dayNumber: null,
      score: 8400,
      rank: "Merchant",
      results,
    });

    expect(text).toContain("FIGURA 2/2");
    expect(text).toContain("🟨🟩");
    expect(text).toContain("Can you beat my journey?");
    expect(text).not.toContain("Secret Figure");
  });

  it("encodes the score, mode, difficulty, and source in challenge links", () => {
    const url = new URL(
      buildChallengeUrl(
        {
          origin: "https://figura.example",
          mode: "classic",
          difficulty: "Explorer",
          score: 12345.4,
        },
        "threads",
      ),
    );

    expect(url.pathname).toBe("/");
    expect(url.searchParams.get("challenge")).toBe("12345");
    expect(url.searchParams.get("mode")).toBe("classic");
    expect(url.searchParams.get("difficulty")).toBe("Explorer");
    expect(url.searchParams.get("ref")).toBe("threads");
  });

  it("accepts only complete, valid friend challenges", () => {
    expect(
      parseFriendChallenge(
        new URLSearchParams("challenge=12345&mode=reverse&difficulty=Conqueror"),
      ),
    ).toEqual({ score: 12345, mode: "reverse", difficulty: "Conqueror" });
    expect(parseFriendChallenge(new URLSearchParams("challenge=oops&mode=reverse"))).toBeNull();
  });
});
