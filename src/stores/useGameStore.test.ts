import { beforeEach, describe, expect, it } from "vitest";

import { calcReverseScore, REVERSE_SCORING } from "../config/gameConfig";
import type { Figure } from "../types/figure";
import { useGameStore } from "./useGameStore";

const figure: Figure = {
  id: "ada-lovelace",
  first_name: "Ada",
  last_name: "Lovelace",
  aliases: [],
  nationality: "British",
  country_of_origin: "United Kingdom",
  flag: "",
  place_of_birth: "London",
  coordinates_of_the_place_of_birth: [51.5, -0.1],
  place_of_death: "London",
  coordinates_of_the_place_of_death: [51.5, -0.1],
  category: "Scientist",
  description: "A mathematician and early computing pioneer.",
  popularity_rating: 99,
  photo: "https://example.com/ada.jpg",
  birth_date: "1815-12-10",
  death_date: "1852-11-27",
};

describe("game-wide hints", () => {
  beforeEach(() => {
    useGameStore.getState().reset();
    useGameStore.getState().startSession({
      nickname: "tester",
      difficulty: "Explorer",
      categories: ["Scientist"],
      queue: [figure, figure],
    });
    useGameStore.getState().beginRound();
  });

  it("allows each hint only once per game", () => {
    expect(useGameStore.getState().activateGameHint("initial")).toBe(true);
    expect(useGameStore.getState().activateGameHint("initial")).toBe(false);
    expect(useGameStore.getState().usedGameHints).toEqual(["initial"]);
    expect(useGameStore.getState().roundGameHints).toEqual(["initial"]);
  });

  it("clears the reveal next round but keeps the hint spent", () => {
    useGameStore.getState().activateGameHint("category");
    useGameStore.getState().skipRound();
    useGameStore.getState().dismissReveal();

    expect(useGameStore.getState().roundGameHints).toEqual([]);
    expect(useGameStore.getState().usedGameHints).toEqual(["category"]);
  });

  it("enforces the Conqueror hint limit", () => {
    useGameStore.getState().reset();
    useGameStore.getState().startSession({
      nickname: "tester",
      difficulty: "Conqueror",
      categories: ["Scientist"],
      queue: [figure],
    });
    useGameStore.getState().beginRound();
    expect(useGameStore.getState().activateGameHint("initial")).toBe(true);
    expect(useGameStore.getState().activateGameHint("category")).toBe(false);
  });

  it("tracks wrong guesses separately from field-note hints in round results", () => {
    useGameStore.getState().activateGameHint("initial");
    useGameStore.getState().submitGuess("Wrong Person");
    useGameStore.getState().submitGuess("Ada Lovelace");

    const result = useGameStore.getState().roundResults[0];
    expect(result.correct).toBe(true);
    expect(result.wrongGuesses).toBe(1);
    expect(result.hintsUsed).toBe(1);
    expect(result.firstGuess).toBe(false);
  });

  it("marks a far-away reverse pin as not correct with no points", () => {
    useGameStore.getState().reset();
    useGameStore.getState().startSession({
      nickname: "tester",
      difficulty: "Explorer",
      categories: ["Scientist"],
      queue: [figure],
      mode: "reverse",
    });
    useGameStore.getState().beginRound();
    // Tokyo is ~9,500 km from London: outside the scoring range and not a catch.
    const result = useGameStore.getState().submitLocation([35.7, 139.7], {
      birthYear: 1815,
      deathYear: 1852,
    });

    expect(result).not.toBeNull();
    expect(useGameStore.getState().roundResults[0].correct).toBe(false);
    expect(useGameStore.getState().roundResults[0].score).toBe(0);
    expect(useGameStore.getState().roundResults[0].guessCoordinates).toEqual([35.7, 139.7]);
  });

  it("scores reverse mode from birthplace and speed without a first-try badge", () => {
    useGameStore.getState().reset();
    useGameStore.getState().startSession({
      nickname: "tester",
      difficulty: "Explorer",
      categories: ["Scientist"],
      queue: [figure],
      mode: "reverse",
    });
    useGameStore.getState().beginRound();
    const result = useGameStore
      .getState()
      .submitLocation([51.5, -0.1], { birthYear: 1815, deathYear: 1852 });
    expect(result?.distanceKm).toBe(0);
    expect(result?.birthYearError).toBe(0);
    expect(result?.deathYearError).toBe(0);
    expect(useGameStore.getState().currentRoundScore).toBe(5000);
    expect(useGameStore.getState().roundResults[0].distanceKm).toBe(0);
    expect(useGameStore.getState().roundResults[0].firstGuess).toBe(false);
    expect(useGameStore.getState().firstGuessStreak).toBe(0);
  });

  it("allows Explorer to skip dates", () => {
    useGameStore.getState().reset();
    useGameStore.getState().startSession({
      nickname: "tester",
      difficulty: "Explorer",
      categories: ["Scientist"],
      queue: [figure],
      mode: "reverse",
    });
    useGameStore.getState().beginRound();

    const result = useGameStore
      .getState()
      .submitLocation([51.5, -0.1], { birthYear: null, deathYear: null });

    expect(result?.score).toBe(5000);
    expect(result?.birthYearError).toBeNull();
    expect(result?.deathYearError).toBeNull();
  });

  it.each(["Scholar", "Conqueror"] as const)("requires dates on %s", (difficulty) => {
    useGameStore.getState().reset();
    useGameStore.getState().startSession({
      nickname: "tester",
      difficulty,
      categories: ["Scientist"],
      queue: [figure],
      mode: "reverse",
    });
    useGameStore.getState().beginRound();

    const result = useGameStore
      .getState()
      .submitLocation([51.5, -0.1], { birthYear: null, deathYear: null });

    expect(result).toBeNull();
    expect(useGameStore.getState().status).toBe("playing");
    expect(useGameStore.getState().roundResults).toEqual([]);
  });

  it("ignores date accuracy when scoring and only reduces speed points over time", () => {
    useGameStore.getState().reset();
    useGameStore.getState().startSession({
      nickname: "tester",
      difficulty: "Explorer",
      categories: ["Scientist"],
      queue: [figure],
      mode: "reverse",
    });
    useGameStore.getState().beginRound();
    useGameStore.getState().tick(15);
    const result = useGameStore
      .getState()
      .submitLocation([51.5, -0.1], { birthYear: 1715, deathYear: 1952 });

    expect(result?.score).toBe(4800);
    expect(useGameStore.getState().roundResults[0].speedScore).toBe(200);
  });
});

describe("reverse scoring", () => {
  it("awards max points through the 2 km perfect radius", () => {
    const score = calcReverseScore(REVERSE_SCORING.perfectRadiusKm, 0);

    expect(score.location).toBe(REVERSE_SCORING.locationPoints);
    expect(score.speed).toBe(REVERSE_SCORING.speedPoints);
    expect(score.total).toBe(REVERSE_SCORING.locationPoints + REVERSE_SCORING.speedPoints);
  });

  it("starts reducing location points immediately after 2 km", () => {
    expect(calcReverseScore(REVERSE_SCORING.perfectRadiusKm + 1, 0).location).toBeLessThan(
      REVERSE_SCORING.locationPoints,
    );
  });

  it("keeps medium-distance misses playable without awarding near-perfect points", () => {
    const score = calcReverseScore(500, 0);

    expect(score.total).toBeGreaterThan(2_500);
    expect(score.location).toBeLessThan(3_000);
  });
});
