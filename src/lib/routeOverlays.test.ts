import { describe, expect, it } from "vitest";

import { buildReverseGuessOverlays } from "./routeOverlays";
import type { Figure, RoundResult } from "../types/figure";

const figure: Figure = {
  id: "figure-1",
  first_name: "Figure",
  last_name: "One",
  aliases: [],
  nationality: "Test",
  country_of_origin: "Test",
  flag: "",
  place_of_birth: "Birthplace",
  coordinates_of_the_place_of_birth: [41.01, 28.97],
  place_of_death: null,
  coordinates_of_the_place_of_death: null,
  category: "History",
  description: "Test figure",
  popularity_rating: 1,
  photo: "",
  birth_date: "1000-01-01",
  death_date: null,
};

const result: RoundResult = {
  round: 1,
  figureId: figure.id,
  figureName: "Figure One",
  score: 3200,
  wrongGuesses: 0,
  hintsUsed: 0,
  timeUsed: 12,
  extraUsed: 0,
  category: "History",
  continent: "Asia",
  correct: true,
  firstGuess: true,
  guessCoordinates: [39.92, 32.85],
};

describe("reverse guess overlays", () => {
  it("connects the player's guess to the original birthplace", () => {
    expect(buildReverseGuessOverlays([result], [figure])).toMatchObject([
      {
        birth: [32.85, 39.92],
        death: [28.97, 41.01],
      },
    ]);
  });

  it("does not draw a route before a map guess exists", () => {
    expect(
      buildReverseGuessOverlays([{ ...result, guessCoordinates: undefined }], [figure]),
    ).toEqual([]);
  });
});
