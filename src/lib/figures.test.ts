import { describe, expect, it } from "vitest";

import type { FigureIndex } from "../types/figure";
import {
  distanceKm,
  inferContinent,
  normalizeName,
  resolveFigureGuess,
  searchFigureSuggestions,
} from "./figures";

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
    death_date: "1980-01-01",
    place_of_birth: "Test birthplace",
    coordinates_of_the_place_of_birth: [0, 0],
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

  it("searches normalized names and aliases up to the requested limit", () => {
    const figures = [
      indexed("leonardo-da-vinci", "Leonardo", "da Vinci", ["Léonard de Vinci"]),
      indexed("leonardo-fibonacci", "Leonardo", "Fibonacci"),
      indexed("albert-einstein", "Albert", "Einstein"),
    ];

    expect(searchFigureSuggestions("leonard", figures, 1).map((figure) => figure.id)).toEqual([
      "leonardo-da-vinci",
    ]);
    expect(searchFigureSuggestions("vinci", figures, 5).map((figure) => figure.id)).toEqual([
      "leonardo-da-vinci",
    ]);
  });

  it("classifies continents at the tricky boundaries", () => {
    expect(inferContinent([24.7, 46.7])).toBe("Asia"); // Riyadh
    expect(inferContinent([31.8, 35.2])).toBe("Asia"); // Jerusalem
    expect(inferContinent([21.4, 39.8])).toBe("Asia"); // Mecca
    expect(inferContinent([30.0, 31.2])).toBe("Africa"); // Cairo
    expect(inferContinent([36.8, 10.2])).toBe("Africa"); // Tunis
    expect(inferContinent([36.75, 3.06])).toBe("Africa"); // Algiers
    expect(inferContinent([36.72, -4.42])).toBe("Europe"); // Malaga
    expect(inferContinent([9.0, 38.7])).toBe("Africa"); // Addis Ababa
    expect(inferContinent([48.85, 2.35])).toBe("Europe"); // Paris
    expect(inferContinent([-41.3, 174.8])).toBe("Oceania"); // Wellington
  });
});
