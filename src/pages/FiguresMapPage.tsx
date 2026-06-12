import { ArrowLeft, MapPinned } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { TopNav } from "../components/TopNav";
import { usePageMetadata } from "../hooks/usePageMetadata";
import { getFullName } from "../lib/figures";
import { getMapStyle } from "../lib/mapStyles";
import type { FigureIndex } from "../types/figure";

const SOURCE_ID = "all-figure-birthplaces";
const DOT_LAYER_ID = "all-figure-birthplace-dots";
const LABEL_LAYER_ID = "all-figure-birthplace-labels";
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
      },
    })),
  };
}

export function FiguresMapPage({ figures }: { figures: FigureIndex[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<{ id: string; name: string; place: string } | null>(null);
  const [visibleFigureCount, setVisibleFigureCount] = useState(
    () => figures.filter((figure) => figure.popularity_rating >= 99).length,
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
        style: getMapStyle("Steppe"),
        center: [20, 24],
        zoom: 1.25,
        minZoom: 1,
        maxZoom: 8,
        renderWorldCopies: false,
        refreshExpiredTiles: false,
        attributionControl: false,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
      map.once("load", () => {
        if (!map) return;
        let activeThreshold = popularityThresholdForZoom(map.getZoom());
        const popularityFilter = (): maplibregl.FilterSpecification => [
          ">=",
          ["get", "popularity"],
          activeThreshold,
        ];
        map.addSource(SOURCE_ID, { type: "geojson", data: toFeatureCollection(figures) });
        map.addLayer({
          id: DOT_LAYER_ID,
          type: "circle",
          source: SOURCE_ID,
          filter: popularityFilter(),
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 2, 6, 5],
            "circle-color": "#efc75a",
            "circle-opacity": 0.75,
            "circle-stroke-color": "#171109",
            "circle-stroke-width": 1,
          },
        });
        map.addLayer({
          id: LABEL_LAYER_ID,
          type: "symbol",
          source: SOURCE_ID,
          filter: popularityFilter(),
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
            "text-color": "#2a1d0c",
            "text-opacity": 0.96,
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
          const filter = popularityFilter();
          map.setFilter(DOT_LAYER_ID, filter);
          map.setFilter(LABEL_LAYER_ID, filter);
          setVisibleFigureCount(
            figures.filter((figure) => figure.popularity_rating >= activeThreshold).length,
          );
        });
      });
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [figures]);

  return (
    <main className="page-shell atlas-page">
      <TopNav />
      <header className="atlas-header">
        <div>
          <span className="atlas-kicker">
            <MapPinned aria-hidden="true" size={16} />
            Showing {visibleFigureCount.toLocaleString()} of {figures.length.toLocaleString()} figures
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
      </section>
    </main>
  );
}
