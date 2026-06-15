import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { TopNav } from "../components/TopNav";
import { LoadingScreen } from "../components/LoadingScreen";
import { LifeJourneyTimeline } from "../components/LifeJourneyTimeline";
import { getLifeJourney } from "../data/lifeJourneys";
import {
  findFigureBySlug,
  getDayNumber,
  getFigureOfTheDay,
  getFigureSlug,
  getUtcDateString,
} from "../lib/dailyChallenge";
import {
  distanceKm,
  getFullName,
  getLifeDateRange,
  getWikipediaUrl,
  hasDeathLocation,
  loadFigureRecord,
} from "../lib/figures";
import { usePageMetadata } from "../hooks/usePageMetadata";
import type { GameMapHandle } from "../lib/mapEngine";
import { useSettingsStore } from "../stores/useSettingsStore";
import type { Figure, FigureIndex } from "../types/figure";

type MapEngine = typeof import("../lib/mapEngine");

type Props = {
  figureIndex: FigureIndex[];
  mode: "today" | "slug";
};

export function FigureProfilePage({ figureIndex, mode }: Props) {
  const params = useParams<{ slug?: string }>();
  const today = useMemo(() => getUtcDateString(), []);
  const selectedIndex = useMemo(() => {
    if (mode === "today") {
      return getFigureOfTheDay(figureIndex, today);
    }
    return params.slug ? findFigureBySlug(figureIndex, params.slug) : null;
  }, [figureIndex, mode, params.slug, today]);
  const [figure, setFigure] = useState<Figure | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setFigure(null);
    setLoadFailed(false);
    if (!selectedIndex) return;
    void loadFigureRecord(selectedIndex.id)
      .then((record) => {
        if (!cancelled) setFigure(record);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedIndex]);
  const metadata = useMemo(() => {
    if (!figure) return null;
    const fullName = getFullName(figure);
    const journey = hasDeathLocation(figure)
      ? `${figure.place_of_birth} to ${figure.place_of_death}`
      : `born in ${figure.place_of_birth}`;
    return {
      title: `${fullName} | Figura`,
      description: `Explore ${fullName}'s life journey from ${journey} and learn who they were.`,
      image: figure.photo,
      imageAlt: `Portrait of ${fullName}`,
      type: "profile" as const,
    };
  }, [figure]);
  const lifeJourney = useMemo(() => (figure ? getLifeJourney(figure.id) : null), [figure]);
  usePageMetadata(metadata);

  const basemap = useSettingsStore((state) => state.basemap);
  const initialBasemapRef = useRef(basemap);
  const mapTextures = useSettingsStore((state) => state.mapTextures);
  const reducedMotionSetting = useSettingsStore((state) => state.reducedMotion);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapEngineRef = useRef<MapEngine | null>(null);
  const mapHandleRef = useRef<GameMapHandle | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current || mapHandleRef.current) {
      return;
    }
    let cancelled = false;
    void import("../lib/mapEngine").then((engine) => {
      if (cancelled || !mapContainerRef.current) {
        return;
      }
      mapEngineRef.current = engine;
      mapHandleRef.current = engine.createGameMap(
        mapContainerRef.current,
        initialBasemapRef.current,
      );
      engine.setMapLocked(mapHandleRef.current, false);
      setMapReady(true);
    });
    return () => {
      cancelled = true;
      if (mapEngineRef.current && mapHandleRef.current) {
        mapEngineRef.current.removeGameMap(mapHandleRef.current);
      }
      mapHandleRef.current = null;
      mapEngineRef.current = null;
      setMapReady(false);
    };
    // basemap intentionally excluded — handled in its own effect
  }, [figure]);

  useEffect(() => {
    if (mapEngineRef.current && mapHandleRef.current) {
      mapEngineRef.current.setBasemap(mapHandleRef.current, basemap);
    }
  }, [basemap]);

  useEffect(() => {
    const engine = mapEngineRef.current;
    const handle = mapHandleRef.current;
    if (!engine || !handle || !figure || !mapReady) return;
    const renderOptions = {
      animateFit: true,
      reducedMotion:
        reducedMotionSetting || window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
    if (lifeJourney) {
      engine.renderLifeJourney(handle, lifeJourney, { ...renderOptions, padding: 42 });
      return;
    }
    engine.renderJourney(
      handle,
      figure,
      {
        birth: { primary: figure.place_of_birth, secondary: figure.birth_date || null },
        death: {
          primary: hasDeathLocation(figure) ? figure.place_of_death : null,
          secondary: figure.death_date || null,
        },
      },
      renderOptions,
    );
  }, [figure, lifeJourney, mapReady, reducedMotionSetting]);

  if (!selectedIndex || loadFailed) {
    return <Navigate to="/" replace />;
  }
  if (!figure) return <LoadingScreen />;

  const fullName = getFullName(figure);
  const journey = hasDeathLocation(figure)
    ? distanceKm(figure.coordinates_of_the_place_of_birth, figure.coordinates_of_the_place_of_death)
    : null;
  const dates = getLifeDateRange(figure);
  const slug = getFigureSlug(figure);
  const dayNumber = mode === "today" ? getDayNumber(today) : null;
  const basemapClassName = `basemap-${basemap.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <main className="page-shell">
      <TopNav />
      <section className="content-panel figure-profile" aria-labelledby="figure-title">
        {dayNumber ? <p className="eyebrow">Figure of the Day · Day {dayNumber}</p> : null}
        <header className="figure-header">
          <img src={figure.photo} alt={fullName} className="figure-photo" loading="eager" />
          <div className="figure-meta">
            <h1 id="figure-title">{fullName}</h1>
            <p className="date-line">{dates}</p>
            <div className="tag-row">
              <span>{figure.nationality}</span>
              <span>{figure.country_of_origin}</span>
              <span>{figure.category}</span>
            </div>
          </div>
        </header>

        <p className="figure-description">{figure.description}</p>

        <section aria-labelledby="figure-map-title" className="figure-map-section">
          <h2 id="figure-map-title">{lifeJourney ? "Chronological life route" : "Journey"}</h2>
          <p className="figure-map-meta">
            {lifeJourney
              ? `${lifeJourney.stops.length} documented stops · ${dates}`
              : journey != null && hasDeathLocation(figure)
                ? `${figure.place_of_birth} → ${figure.place_of_death} · ${journey.toLocaleString()} km`
                : `Born in ${figure.place_of_birth}`}
          </p>
          <div
            ref={mapContainerRef}
            className={`figure-map ${basemapClassName}${mapTextures ? "" : " no-map-textures"}`}
            aria-label="Birth and death locations"
          />
        </section>
        {lifeJourney ? <LifeJourneyTimeline journey={lifeJourney} /> : null}

        <div className="action-row">
          {mode === "today" ? (
            <Link className="primary-button" to="/daily">
              Play today's challenge
            </Link>
          ) : (
            <Link className="primary-button" to="/">
              Play a new game
            </Link>
          )}
          <a
            className="secondary-button"
            href={getWikipediaUrl(figure)}
            target="_blank"
            rel="noreferrer"
          >
            View on Wikipedia
          </a>
          {mode === "today" ? (
            <Link className="secondary-button" to={`/figure/${slug}`}>
              Permalink to this profile
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
