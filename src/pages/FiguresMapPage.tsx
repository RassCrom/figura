import { ArrowLeft, MapPinned, ScrollText } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";

import { TopNav } from "../components/TopNav";
import { usePageMetadata } from "../hooks/usePageMetadata";
import { getFullName, parseHistoricalYear } from "../lib/figures";
import { getMapStyle } from "../lib/mapStyles";
import type { FigureIndex } from "../types/figure";

const SOURCE_ID = "all-figure-birthplaces";
const RING_LAYER_ID = "all-figure-birthplace-rings";
const DOT_LAYER_ID = "all-figure-birthplace-dots";
const LABEL_LAYER_ID = "all-figure-birthplace-labels";
const CURRENT_YEAR = 2026;
const DEFAULT_ATLAS_YEAR = 1500;
const ATLAS_METADATA = {
  title: "Birthplaces of famous people | Figura Atlas",
  description:
    "Explore every historical figure in Figura on an interactive world map, placed at their birthplace.",
};

function popularityThresholdForZoom(zoom: number): number {
  if (zoom < 2) return 99;
  if (zoom < 3) return 97;
  if (zoom < 4) return 94;
  if (zoom < 5) return 90;
  if (zoom < 6) return 80;
  if (zoom < 7) return 65;
  return 0;
}

function toFeatureCollection(figures: FigureIndex[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: figures.map((figure) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [
          figure.coordinates_of_the_place_of_birth[1],
          figure.coordinates_of_the_place_of_birth[0],
        ],
      },
      properties: {
        id: figure.id,
        name: getFullName(figure),
        place: figure.place_of_birth,
        category: figure.category,
        popularity: figure.popularity_rating,
        birthYear: parseHistoricalYear(figure.birth_date) ?? -4000,
        deathYear: parseHistoricalYear(figure.death_date) ?? CURRENT_YEAR,
      },
    })),
  };
}

function formatHistoricalYear(year: number): string {
  return year < 0 ? `${Math.abs(year)} BC` : `${year} AD`;
}

export function FiguresMapPage({ figures }: { figures: FigureIndex[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const activeThresholdRef = useRef(99);
  const selectedYearRef = useRef(DEFAULT_ATLAS_YEAR);
  const [selected, setSelected] = useState<{ id: string; name: string; place: string } | null>(
    null,
  );
  const yearBounds = useMemo(() => {
    const birthYears = figures
      .map((figure) => parseHistoricalYear(figure.birth_date))
      .filter((year): year is number => year !== null);
    return {
      min: Math.floor(Math.min(...birthYears) / 100) * 100,
      max: CURRENT_YEAR,
    };
  }, [figures]);
  const [selectedYear, setSelectedYear] = useState(DEFAULT_ATLAS_YEAR);
  const [visibleFigureCount, setVisibleFigureCount] = useState(
    () =>
      figures.filter((figure) => {
        const birthYear = parseHistoricalYear(figure.birth_date);
        const deathYear = parseHistoricalYear(figure.death_date) ?? CURRENT_YEAR;
        return (
          figure.popularity_rating >= 99 &&
          birthYear !== null &&
          birthYear <= DEFAULT_ATLAS_YEAR &&
          deathYear >= DEFAULT_ATLAS_YEAR
        );
      }).length,
  );
  const timelineProgress =
    ((selectedYear - yearBounds.min) / (yearBounds.max - yearBounds.min)) * 100;

  const applyAtlasFilter = useCallback(
    (map: import("maplibre-gl").Map, year: number, threshold: number) => {
      const filter: import("maplibre-gl").FilterSpecification = [
        "all",
        [">=", ["get", "popularity"], threshold],
        ["<=", ["get", "birthYear"], year],
        [">=", ["get", "deathYear"], year],
      ];
      map.setFilter(RING_LAYER_ID, filter);
      map.setFilter(DOT_LAYER_ID, filter);
      map.setFilter(LABEL_LAYER_ID, filter);
      setVisibleFigureCount(
        figures.filter((figure) => {
          const birthYear = parseHistoricalYear(figure.birth_date);
          const deathYear = parseHistoricalYear(figure.death_date) ?? CURRENT_YEAR;
          return (
            figure.popularity_rating >= threshold &&
            birthYear !== null &&
            birthYear <= year &&
            deathYear >= year
          );
        }).length,
      );
    },
    [figures],
  );

  usePageMetadata(ATLAS_METADATA);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let map: import("maplibre-gl").Map | null = null;

    void import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !containerRef.current) return;
      map = new maplibregl.Map({
        container: containerRef.current,
        style: getMapStyle("Medivial"),
        center: [20, 24],
        zoom: 1.25,
        minZoom: 1,
        maxZoom: 8,
        renderWorldCopies: false,
        refreshExpiredTiles: false,
        attributionControl: false,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
      map.once("load", () => {
        if (!map) return;
        let activeThreshold = popularityThresholdForZoom(map.getZoom());
        activeThresholdRef.current = activeThreshold;
        const atlasFilter = (): maplibregl.FilterSpecification => [
          "all",
          [">=", ["get", "popularity"], activeThreshold],
          ["<=", ["get", "birthYear"], selectedYearRef.current],
          [">=", ["get", "deathYear"], selectedYearRef.current],
        ];
        map.addSource(SOURCE_ID, { type: "geojson", data: toFeatureCollection(figures) });
        map.addLayer({
          id: RING_LAYER_ID,
          type: "circle",
          source: SOURCE_ID,
          filter: atlasFilter(),
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              1,
              ["interpolate", ["linear"], ["get", "popularity"], 0, 4, 100, 10],
              6,
              ["interpolate", ["linear"], ["get", "popularity"], 0, 7, 100, 22],
            ],
            "circle-color": "rgba(239, 199, 90, 0.03)",
            "circle-stroke-color": "#efc75a",
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 1, 0.75, 6, 1.4],
            "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 1, 0.44, 6, 0.72],
          },
        });
        map.addLayer({
          id: DOT_LAYER_ID,
          type: "circle",
          source: SOURCE_ID,
          filter: atlasFilter(),
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 2.8, 6, 5.5],
            "circle-color": [
              "interpolate",
              ["linear"],
              ["get", "popularity"],
              0,
              "#b9872e",
              85,
              "#e4b94d",
              100,
              "#ffe29a",
            ],
            "circle-opacity": 0.94,
            "circle-stroke-color": "rgba(20, 14, 7, 0.92)",
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 1, 0.8, 6, 1.5],
          },
        });
        map.addLayer({
          id: LABEL_LAYER_ID,
          type: "symbol",
          source: SOURCE_ID,
          filter: atlasFilter(),
          layout: {
            "text-field": ["get", "name"],
            "text-font": ["Noto Sans Regular"],
            "text-size": ["interpolate", ["linear"], ["zoom"], 1, 11, 5, 15],
            "text-letter-spacing": 0.02,
            "text-offset": [0, 0.9],
            "text-anchor": "top",
            "text-optional": true,
            "text-padding": 5,
          },
          paint: {
            "text-color": "#f7e5b5",
            "text-opacity": 0.96,
            "text-halo-color": "rgba(17, 12, 6, 0.9)",
            "text-halo-width": 1.5,
            "text-halo-blur": 0.6,
          },
        });
        map.on("click", DOT_LAYER_ID, (event) => {
          const properties = event.features?.[0]?.properties;
          if (properties) {
            setSelected({
              id: String(properties.id),
              name: String(properties.name),
              place: String(properties.place),
            });
          }
        });
        map.on("mouseenter", DOT_LAYER_ID, () => {
          if (map) map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", DOT_LAYER_ID, () => {
          if (map) map.getCanvas().style.cursor = "";
        });
        map.on("zoom", () => {
          if (!map) return;
          const nextThreshold = popularityThresholdForZoom(map.getZoom());
          if (nextThreshold === activeThreshold) return;
          activeThreshold = nextThreshold;
          activeThresholdRef.current = activeThreshold;
          applyAtlasFilter(map, selectedYearRef.current, activeThreshold);
        });
      });
    });

    return () => {
      cancelled = true;
      mapRef.current = null;
      map?.remove();
    };
  }, [applyAtlasFilter, figures]);

  useEffect(() => {
    selectedYearRef.current = selectedYear;
    if (!mapRef.current?.getLayer(DOT_LAYER_ID)) return;
    applyAtlasFilter(mapRef.current, selectedYear, activeThresholdRef.current);
    setSelected(null);
  }, [applyAtlasFilter, selectedYear]);

  return (
    <main className="page-shell atlas-page">
      <TopNav />
      <header className="atlas-header">
        <div>
          <span className="atlas-kicker">
            <MapPinned aria-hidden="true" size={16} />
            Showing {visibleFigureCount.toLocaleString()} of {figures.length.toLocaleString()}{" "}
            figures
          </span>
          <h1>Birthplace Atlas</h1>
          <p>Zoom in to reveal more names. Select a gold point to open its figure.</p>
        </div>
        <Link className="secondary-button" to="/">
          <ArrowLeft aria-hidden="true" size={17} />
          Back to game
        </Link>
      </header>
      <section className="atlas-map-frame" aria-label="Map of figure birthplaces">
        <div ref={containerRef} className="atlas-map" />
        {selected ? (
          <aside className="atlas-selection" aria-live="polite">
            <span>Born in {selected.place}</span>
            <strong>{selected.name}</strong>
            <Link to={`/figure/${selected.id}`}>Open figure</Link>
          </aside>
        ) : null}
        <div
          className="atlas-timeline"
          style={{ "--timeline-progress": `${timelineProgress}%` } as CSSProperties}
        >
          <div className="atlas-timeline-heading">
            <span>
              <ScrollText aria-hidden="true" size={17} />
              Year of the chronicle
            </span>
            <strong>{formatHistoricalYear(selectedYear)}</strong>
          </div>
          <input
            type="range"
            min={yearBounds.min}
            max={yearBounds.max}
            step={1}
            value={selectedYear}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
            aria-label="Filter figures alive during year"
            aria-valuetext={formatHistoricalYear(selectedYear)}
          />
          <div className="atlas-timeline-ends" aria-hidden="true">
            <span>{formatHistoricalYear(yearBounds.min)}</span>
            <span>{formatHistoricalYear(yearBounds.max)}</span>
          </div>
        </div>
      </section>
    </main>
  );
}
