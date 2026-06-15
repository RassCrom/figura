import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { GAME_CONFIG } from "../../config/gameConfig";
import { en } from "../../i18n/en";
import {
  distanceKm,
  getLifeDateRange,
  getFullName,
  getWikipediaUrl,
  hasDeathLocation,
} from "../../lib/figures";
import type { Figure, RoundResult } from "../../types/figure";

export function PersonCard({
  figure,
  roundScore,
  onDismiss,
  cinematic,
  autoAdvance,
  roundResult,
}: {
  figure: Figure;
  roundScore: number;
  onDismiss: () => void;
  cinematic: boolean;
  autoAdvance: boolean;
  roundResult?: RoundResult | null;
}) {
  const [remainingMs, setRemainingMs] = useState<number>(GAME_CONFIG.revealAutoDismissMs);
  const journey = hasDeathLocation(figure)
    ? distanceKm(figure.coordinates_of_the_place_of_birth, figure.coordinates_of_the_place_of_death)
    : null;
  const dates = getLifeDateRange(figure);

  useEffect(() => {
    if (!autoAdvance) {
      setRemainingMs(0);
      return;
    }
    const startedAt = performance.now();
    const timer = window.setTimeout(onDismiss, GAME_CONFIG.revealAutoDismissMs);
    const interval = window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      setRemainingMs(Math.max(0, GAME_CONFIG.revealAutoDismissMs - elapsed));
    }, 250);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [autoAdvance, onDismiss]);

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

  return (
    <div
      className={cinematic ? "reveal-backdrop cinematic" : "reveal-backdrop"}
      onClick={onDismiss}
      role="presentation"
    >
      <article
        className={cinematic ? "person-card cinematic-card" : "person-card"}
        onClick={(event) => event.stopPropagation()}
      >
        {autoAdvance ? <div className="reveal-progress" aria-hidden="true" /> : null}
        <button
          className="icon-button close-button"
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss card"
        >
          <X aria-hidden="true" size={18} />
        </button>
        <img src={figure.photo} alt={getFullName(figure)} loading="eager" />
        <div className="person-details">
          <p className="eyebrow">Round score +{roundScore.toLocaleString()}</p>
          {roundResult?.distanceKm != null ? (
            <div className="reverse-result-summary">
              <p className="reverse-distance">
                Birthplace estimate:{" "}
                <strong>{roundResult.distanceKm.toLocaleString()} km away</strong>
              </p>
              <div className="reverse-score-breakdown">
                <span>Map +{roundResult.locationScore?.toLocaleString() ?? 0}</span>
                <span>Speed +{roundResult.speedScore?.toLocaleString() ?? 0}</span>
              </div>
            </div>
          ) : null}
          <h2>{getFullName(figure)}</h2>
          <p className="date-line">{dates}</p>
          <div className="tag-row">
            <span>{figure.nationality}</span>
            <span>{figure.country_of_origin}</span>
          </div>
          <p className="description-label">{en.description}</p>
          <p>{figure.description}</p>
          {journey != null ? (
            <div className="distance-block">
              <span>{en.journeyDistance}</span>
              <strong>{journey.toLocaleString()} km</strong>
            </div>
          ) : (
            <div className="distance-block">
              <span>Birthplace</span>
              <strong>{figure.place_of_birth}</strong>
            </div>
          )}
          <div className="reveal-controls">
            <span>
              {autoAdvance ? `Next in ${Math.ceil(remainingMs / 1000)}s` : "Ready when you are"}
            </span>
            <button className="primary-button" type="button" onClick={onDismiss}>
              Next
            </button>
          </div>
          <a className="wiki-link" href={getWikipediaUrl(figure)} target="_blank" rel="noreferrer">
            {en.wikipedia}
          </a>
        </div>
      </article>
    </div>
  );
}
