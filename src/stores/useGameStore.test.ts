import { beforeEach, describe, expect, it } from "vitest";

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

  it("scores reverse mode from birthplace, lifetime, and speed without a first-try badge", () => {
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

  it("reduces reverse score for inaccurate years and time spent", () => {
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

    expect(result?.score).toBeLessThan(5000);
    expect(useGameStore.getState().roundResults[0].timelineScore).toBeLessThan(1600);
    expect(useGameStore.getState().roundResults[0].speedScore).toBe(200);
  });
});
