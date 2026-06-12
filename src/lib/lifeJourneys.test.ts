import { describe, expect, it } from "vitest";

import { getLifeJourneys } from "../data/lifeJourneys";

describe("curated life journeys", () => {
  const journeys = getLifeJourneys();

  it("contains ten mapped figures", () => {
    expect(journeys).toHaveLength(10);
    expect(new Set(journeys.map((journey) => journey.figureId)).size).toBe(10);
  });

  it("keeps every route chronological and geographically valid", () => {
    for (const journey of journeys) {
      expect(journey.stops.length).toBeGreaterThanOrEqual(4);
      expect(journey.sources.length).toBeGreaterThan(0);

      for (const [index, stop] of journey.stops.entries()) {
        const [lat, lng] = stop.coordinates;
        expect(lat).toBeGreaterThanOrEqual(-90);
        expect(lat).toBeLessThanOrEqual(90);
        expect(lng).toBeGreaterThanOrEqual(-180);
        expect(lng).toBeLessThanOrEqual(180);
        if (index > 0) {
          expect(stop.year).toBeGreaterThanOrEqual(journey.stops[index - 1].year);
        }
      }
    }
  });
});
