import type { RouteOverlay } from "./mapEngine";
import type { Coordinates, Figure, RoundResult } from "../types/figure";
import { hasDeathLocation } from "./figures";

type BuildRouteOptions = {
  correctOnly?: boolean;
  ghost?: boolean;
};

function toLngLat([lat, lng]: Coordinates): [number, number] {
  return [lng, lat];
}

export function getRoundRouteColor(result: RoundResult): string {
  if (!result.correct) {
    return "#c5675f";
  }
  if (result.firstGuess) {
    return "#9fdfa0";
  }
  return "#ecd08a";
}

export function getRoundRouteLabel(result: RoundResult): string {
  if (!result.correct) {
    return "Missed";
  }
  if (result.firstGuess) {
    return "First try";
  }
  return "Solved";
}

/** Where-mode legend: label the two endpoints of the guess->birthplace arc, no correct/miss wording. */
export function getReverseRouteLegendLabel(result: RoundResult): string {
  return `Guess ${result.round} → Birthplace`;
}

/** Where-mode route atlas: draws each round's guessed point to the actual birthplace (no deathplace). */
export function buildReverseGuessOverlays(results: RoundResult[], queue: Figure[]): RouteOverlay[] {
  return results.flatMap((result) => {
    const figure = queue[result.round - 1];
    if (!figure || !result.guessCoordinates) {
      return [];
    }

    return [
      {
        id: `guess-${result.round}-${result.figureName}`,
        birth: toLngLat(result.guessCoordinates),
        death: toLngLat(figure.coordinates_of_the_place_of_birth),
        color: getRoundRouteColor(result),
        opacity: result.correct ? 0.82 : 0.68,
        width: 3.2,
        dasharray: result.correct ? undefined : [2, 1.5],
      },
    ];
  });
}

export function buildRoundRouteOverlays(
  results: RoundResult[],
  queue: Figure[],
  options: BuildRouteOptions = {},
): RouteOverlay[] {
  return results.flatMap((result) => {
    if (options.correctOnly && !result.correct) {
      return [];
    }
    const figure = queue[result.round - 1];
    if (!figure || !hasDeathLocation(figure)) {
      return [];
    }

    return [
      {
        id: `round-${result.round}-${result.figureName}`,
        birth: toLngLat(figure.coordinates_of_the_place_of_birth),
        death: toLngLat(figure.coordinates_of_the_place_of_death),
        color: getRoundRouteColor(result),
        opacity: options.ghost ? 0.28 : result.correct ? 0.82 : 0.68,
        width: options.ghost ? 1.8 : 3.2,
        dasharray: options.ghost ? [1.4, 1.6] : result.correct ? undefined : [2, 1.5],
      },
    ];
  });
}
