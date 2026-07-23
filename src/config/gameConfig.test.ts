import { describe, expect, it } from "vitest";

import { calcRoundScore, GAME_CONFIG } from "./gameConfig";

describe("classic scoring", () => {
  it("keeps a correct answer valuable after several wrong guesses", () => {
    const score = calcRoundScore(3, 20, 0, false, 30);

    expect(score).toBeGreaterThanOrEqual(3_000);
    expect(GAME_CONFIG.wrongPenalty).toBe(700);
  });

  it("makes speed a modest bonus instead of a dominant penalty", () => {
    const instant = calcRoundScore(0, 0, 0, false, 30);
    const atDeadline = calcRoundScore(0, 30, 0, false, 30);

    expect(instant - atDeadline).toBe(GAME_CONFIG.timeBonusMax);
    expect(GAME_CONFIG.timeBonusMax).toBe(500);
  });

  it("charges extra-bank time at half weight", () => {
    const withExtraTime = calcRoundScore(0, 30, 10, false, 30);

    expect(withExtraTime).toBe(GAME_CONFIG.baseScore);
  });
});
