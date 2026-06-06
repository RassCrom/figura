import { describe, expect, it } from "vitest";

import { distanceKm, normalizeName } from "./figures";

describe("figure helpers", () => {
  it("normalizes punctuation and diacritics", () => {
    expect(normalizeName("Léonardo_da Vinci")).toBe("leonardo da vinci");
  });

  it("returns zero distance for identical coordinates", () => {
    expect(distanceKm([51.5, -0.1], [51.5, -0.1])).toBe(0);
  });
});
