import { describe, expect, it } from "vitest";

import type { FigureIndex } from "../types/figure";
import { distanceKm, normalizeName, resolveFigureGuess } from "./figures";

function indexed(
  id: string,
  firstName: string,
  lastName: string,
  aliases: string[] = [],
): FigureIndex {
  return {
    id,
    first_name: firstName,
    last_name: lastName,
    aliases,
    category: "Scientist",
    popularity_rating: 99,
    birth_date: "1900-01-01",
  };
}

describe("figure helpers", () => {
  it("normalizes punctuation and diacritics", () => {
    expect(normalizeName("Léonardo_da Vinci")).toBe("leonardo da vinci");
  });

  it("returns zero distance for identical coordinates", () => {
    expect(distanceKm([51.5, -0.1], [51.5, -0.1])).toBe(0);
  });

  it("resolves unique surnames, aliases, and small typos", () => {
    const figures = [
      indexed("albert-einstein", "Albert", "Einstein"),
      indexed("leonardo-da-vinci", "Leonardo", "da Vinci", ["Da Vinci"]),
    ];
    expect(resolveFigureGuess("Einstein", figures)?.id).toBe("albert-einstein");
    expect(resolveFigureGuess("Da Vinci", figures)?.id).toBe("leonardo-da-vinci");
    expect(resolveFigureGuess("Albert Einstien", figures)?.id).toBe("albert-einstein");
  });

  it("does not accept an ambiguous surname", () => {
    const figures = [
      indexed("john-smith", "John", "Smith"),
      indexed("jane-smith", "Jane", "Smith"),
    ];
    expect(resolveFigureGuess("Smith", figures)).toBeNull();
  });
});
