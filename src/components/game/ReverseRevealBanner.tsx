import { useEffect } from "react";

import { getFullName, getLifeDateRange } from "../../lib/figures";
import type { Figure, RoundResult } from "../../types/figure";

type Props = {
  figure: Figure;
  roundScore: number;
  roundResult: RoundResult | null;
  onDismiss: () => void;
};

export function ReverseRevealBanner({ figure, roundScore, roundResult, onDismiss }: Props) {
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" || event.key === " " || event.key === "Enter") {
        event.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onDismiss]);

  const dates = getLifeDateRange(figure);
  const distance = roundResult?.distanceKm;
  const birthError = roundResult?.birthYearError;
  const deathError = roundResult?.deathYearError;

  return (
    <div
      className="reverse-reveal-banner"
      role="dialog"
      aria-live="polite"
      aria-label="Round result"
    >
      <div className="reverse-reveal-banner-top">
        <div className="reverse-reveal-identity">
          <p className="eyebrow">+{roundScore.toLocaleString()} pts</p>
          <h2>{getFullName(figure)}</h2>
          <p className="date-line">
            {dates} &middot; {figure.place_of_birth}
          </p>
        </div>
        <button className="primary-button" type="button" onClick={onDismiss} autoFocus>
          Next
        </button>
      </div>
      {distance != null ? (
        <div className="reverse-reveal-stats">
          <span>
            <small>Distance</small>
            <strong>{distance.toLocaleString()} km</strong>
          </span>
          {birthError != null ? (
            <span>
              <small>Birth off</small>
              <strong>{birthError}y</strong>
            </span>
          ) : null}
          {deathError != null ? (
            <span>
              <small>Death off</small>
              <strong>{deathError}y</strong>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
