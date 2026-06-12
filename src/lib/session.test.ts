import { describe, expect, it } from "vitest";

import type { Figure } from "../types/figure";
import { getDailyFigures } from "./dailyChallenge";
import { buildFigureQueue } from "./session";

function figure(name: string, popularity: number, category = "Scientist"): Figure {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    first_name: name,
    last_name: "Figure",
    aliases: [],
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
  figure("Easy One", 100),
  figure("Easy Two", 98),
  figure("Middle One", 88),
  figure("Middle Two", 87),
  figure("Middle Three", 86),
  figure("Extra", 75),
];

describe("five-round figure queues", () => {
  it("places distinct 98+ figures at the first and last session rounds", () => {
    const { queue } = buildFigureQueue(figures, "Scholar", ["Scientist"]);

    expect(queue).toHaveLength(5);
    expect(queue[0].popularity_rating).toBeGreaterThanOrEqual(98);
    expect(queue[4].popularity_rating).toBeGreaterThanOrEqual(98);
    expect(queue[0].first_name).not.toBe(queue[4].first_name);
  });

  it("places distinct 98+ figures at the first and last daily rounds", () => {
    const queue = getDailyFigures(figures, "2026-06-08");

    expect(queue).toHaveLength(5);
    expect(queue[0].popularity_rating).toBeGreaterThanOrEqual(98);
    expect(queue[4].popularity_rating).toBeGreaterThanOrEqual(98);
    expect(queue[0].first_name).not.toBe(queue[4].first_name);
  });

  it("does not add easy bookends on Conqueror", () => {
    const conquerorFigures = [
      ...figures,
      figure("Obscure One", 70),
      figure("Obscure Two", 69),
      figure("Obscure Three", 68),
      figure("Obscure Four", 67),
      figure("Obscure Five", 66),
    ];
    const { queue } = buildFigureQueue(conquerorFigures, "Conqueror", ["Scientist"]);
    expect(queue).toHaveLength(5);
    expect(queue[0].popularity_rating).toBeLessThan(98);
    expect(queue[4].popularity_rating).toBeLessThan(98);
  });

  it("never leaks figures from unselected categories when difficulty is relaxed", () => {
    const mixedFigures = [
      figure("Sport One", 100, "Sportsman"),
      figure("Sport Two", 88, "Sportsman"),
      figure("Sport Three", 70, "Sportsman"),
      figure("Scientist One", 99, "Scientist"),
      figure("Scientist Two", 87, "Scientist"),
      figure("Scientist Three", 65, "Scientist"),
    ];

    const { queue, relaxed } = buildFigureQueue(mixedFigures, "Scholar", ["Sportsman"]);

    expect(relaxed).toBe(true);
    expect(queue).toHaveLength(3);
    expect(queue.every((item) => item.category === "Sportsman")).toBe(true);
  });
});
