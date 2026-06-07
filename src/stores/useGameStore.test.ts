import { beforeEach, describe, expect, it } from "vitest";

import type { Figure } from "../types/figure";
import { useGameStore } from "./useGameStore";

const figure: Figure = {
  first_name: "Ada",
  last_name: "Lovelace",
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
});
