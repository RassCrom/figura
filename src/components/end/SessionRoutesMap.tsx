import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { buildRoundRouteOverlays, getRoundRouteColor, getRoundRouteLabel } from "../../lib/routeOverlays";
import type { Figure, RoundResult } from "../../types/figure";
import type { GameMapHandle } from "../../lib/mapEngine";

type MapEngine = typeof import("../../lib/mapEngine");

export function SessionRoutesMap({ results, queue }: { results: RoundResult[]; queue: Figure[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapEngineRef = useRef<MapEngine | null>(null);
  const mapRef = useRef<GameMapHandle | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const routes = useMemo(() => buildRoundRouteOverlays(results, queue), [queue, results]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    let cancelled = false;
    void import("../../lib/mapEngine").then((engine) => {
      if (cancelled || !containerRef.current) {
        return;
      }
      mapEngineRef.current = engine;
      mapRef.current = engine.createGameMap(containerRef.current, "Steppe");
      engine.setMapLocked(mapRef.current, true);
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      if (mapEngineRef.current && mapRef.current) {
        mapEngineRef.current.removeGameMap(mapRef.current);
      }
      mapEngineRef.current = null;
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapEngineRef.current || !mapRef.current) {
      return;
    }
    mapEngineRef.current.renderRouteOverlay(mapRef.current, routes, {
      fit: true,
      animateFit: true,
      animateRoutes: true,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      padding: 52,
      maxZoom: 3.7,
    });
  }, [mapReady, routes]);

  if (routes.length === 0) {
    return null;
  }

  return (
    <section className="route-atlas-section" aria-labelledby="route-atlas-title">
      <div className="route-atlas-header">
        <div>
          <p className="eyebrow">Route atlas</p>
          <h2 id="route-atlas-title">All 5 journeys</h2>
        </div>
        <span>{results.filter((result) => result.correct).length}/5 solved</span>
      </div>
      <div className="routes-map-frame basemap-steppe">
        <div ref={containerRef} className="routes-map" aria-label="Map of all route arcs" />
        <div className="routes-map-vignette" aria-hidden="true" />
      </div>
      <div className="route-legend" aria-label="Route result colors">
        {results.map((result) => (
          <span
            key={`${result.round}-${result.figureName}`}
            className="route-legend-item"
            style={{ "--route-color": getRoundRouteColor(result) } as CSSProperties}
          >
            <strong>{result.round}</strong>
            {getRoundRouteLabel(result)}
          </span>
        ))}
      </div>
    </section>
  );
}
