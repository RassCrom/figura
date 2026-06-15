import { MapPin } from "lucide-react";

import type { LifeJourney } from "../data/lifeJourneys";
import { getTrustedReferenceUrl } from "../lib/figures";

export function LifeJourneyTimeline({ journey }: { journey: LifeJourney }) {
  const safeSources = journey.sources.flatMap((source) => {
    const trustedSource = getTrustedReferenceUrl(source);
    return trustedSource ? [trustedSource] : [];
  });

  return (
    <section className="life-journey-timeline" aria-labelledby="life-journey-title">
      <header>
        <div>
          <p className="eyebrow">Curated geographic story</p>
          <h2 id="life-journey-title">Life route</h2>
        </div>
        <span>{journey.stops.length} mapped stops</span>
      </header>
      <ol>
        {journey.stops.map((stop, index) => (
          <li key={`${stop.year}-${stop.place}`}>
            <span className="life-journey-index">{index + 1}</span>
            <div>
              <strong>
                {stop.year} · {stop.place}
              </strong>
              <span>{stop.event}</span>
            </div>
          </li>
        ))}
      </ol>
      <p className="life-journey-note">
        <MapPin aria-hidden="true" size={14} />
        Lines connect documented stops chronologically; they do not represent exact travel paths.
      </p>
      {safeSources.length > 0 ? (
        <div className="life-journey-sources">
          Sources:
          {safeSources.map((source, index) => (
            <a key={source} href={source} target="_blank" rel="noreferrer">
              {index + 1}
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}
