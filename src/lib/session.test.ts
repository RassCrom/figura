import { describe, expect, it } from "vitest";

import type { Figure } from "../types/figure";
import { getDailyFigures } from "./dailyChallenge";
import { buildFigureQueue } from "./session";

function figure(name: string, popularity: number, category = "Scientist"): Figure {
  return {
    first_name: name,
    last_name: "Figure",
    nationality: "Test",
    country_of_origin: "Test",
    flag: "",
    place_of_birth: "Birthplace",
    coordinates_of_the_place_of_birth: [0, 0],
    place_of_death: "Deathplace",
    coordinates_of_the_place_of_death: [1, 1],
    category,
    description: "Test figure",
    popularity_rating: popularity,
    photo: "https://example.com/photo.jpg",
    birth_date: "1900-01-01",
    death_date: "1980-01-01",
  };
}

const figures = [
  figure("Easy One", 100, "Leader"),
  figure("Easy Two", 98, "Artist"),
  figure("Middle One", 88),
  figure("Middle Two", 87),
  figure("Middle Three", 86),
  figure("Extra", 75),
];

describe("five-round figure queues", () => {
  it("places distinct 97+ figures at the first and last session rounds", () => {
    const { queue } = buildFigureQueue(figures, "Scholar", ["Scientist"]);

    expect(queue).toHaveLength(5);
    expect(queue[0].popularity_rating).toBeGreaterThanOrEqual(97);
    expect(queue[4].popularity_rating).toBeGreaterThanOrEqual(97);
    expect(queue[0].first_name).not.toBe(queue[4].first_name);
  });

  it("places distinct 97+ figures at the first and last daily rounds", () => {
    const queue = getDailyFigures(figures, "2026-06-08");

    expect(queue).toHaveLength(5);
    expect(queue[0].popularity_rating).toBeGreaterThanOrEqual(97);
    expect(queue[4].popularity_rating).toBeGreaterThanOrEqual(97);
    expect(queue[0].first_name).not.toBe(queue[4].first_name);
  });
});
