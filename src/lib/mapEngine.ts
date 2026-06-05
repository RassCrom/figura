import greatCircle from "@turf/great-circle";
import maplibregl, { type LngLatBoundsLike, type Marker } from "maplibre-gl";

import type { Basemap, Figure } from "../types/figure";
import { getRasterStyle } from "./mapStyles";

type MarkerKind = "birth" | "death";

type MarkerHint = {
  primary: string | null;
  secondary: string | null;
};

export type JourneyHints = {
  birth: MarkerHint;
  death: MarkerHint;
};

export type GameMapHandle = {
  map: maplibregl.Map;
  markers: Marker[];
  dotMarker: Marker | null;
  animationFrame: number;
};

const arcCache = new Map<string, GeoJSON.Feature<GeoJSON.LineString>>();

function toLngLat([lat, lng]: [number, number]): [number, number] {
  return [lng, lat];
}

function arcCacheKey(figure: Figure): string {
  return [
    figure.first_name,
    figure.last_name,
    ...figure.coordinates_of_the_place_of_birth,
    ...figure.coordinates_of_the_place_of_death,
  ].join(":");
}

function makeMarker(kind: MarkerKind, hint: MarkerHint): HTMLElement {
  const element = document.createElement("div");
  element.className = `map-marker ${kind}`;
  element.setAttribute("aria-label", kind === "birth" ? "Birth location" : "Death location");
  element.innerHTML =
    kind === "birth"
      ? '<span class="marker-pin birth-pin"><span class="marker-inner"></span></span>'
      : '<span class="marker-pin death-pin"><span class="marker-inner death-cross"></span></span>';

  if (hint.primary) {
    const primaryHint = document.createElement("span");
    primaryHint.className = "marker-hint marker-hint-primary";
    primaryHint.textContent = hint.primary;
    element.appendChild(primaryHint);
  }

  if (hint.secondary) {
    const secondaryHint = document.createElement("span");
    secondaryHint.className = "marker-hint marker-hint-secondary";
    secondaryHint.textContent = hint.secondary;
    element.appendChild(secondaryHint);
  }

  return element;
}

function getCachedArc(figure: Figure): GeoJSON.Feature<GeoJSON.LineString> {
  const key = arcCacheKey(figure);
  const cached = arcCache.get(key);
  if (cached) {
    return cached;
  }

  const birth = toLngLat(figure.coordinates_of_the_place_of_birth);
  const death = toLngLat(figure.coordinates_of_the_place_of_death);
  const arc = greatCircle(birth, death, { npoints: 140 }) as GeoJSON.Feature<GeoJSON.LineString>;
  arcCache.set(key, arc);
  return arc;
}

export function createGameMap(container: HTMLElement, basemap: Basemap): GameMapHandle {
  const map = new maplibregl.Map({
    container,
    style: getRasterStyle(basemap),
    center: [45, 35],
    zoom: 1.3,
    attributionControl: false,
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
  map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

  return {
    map,
    markers: [],
    dotMarker: null,
    animationFrame: 0,
  };
}

export function setBasemap(handle: GameMapHandle, basemap: Basemap): void {
  handle.map.setStyle(getRasterStyle(basemap));
}

export function setMapLocked(handle: GameMapHandle, locked: boolean): void {
  if (locked) {
    handle.map.dragPan.disable();
    handle.map.scrollZoom.disable();
    return;
  }

  handle.map.dragPan.enable();
  handle.map.scrollZoom.enable();
}

export function clearJourney(handle: GameMapHandle): void {
  window.cancelAnimationFrame(handle.animationFrame);
  handle.markers.forEach((marker) => marker.remove());
  handle.markers = [];
  handle.dotMarker?.remove();
  handle.dotMarker = null;

  if (handle.map.getLayer("journey-arc")) {
    handle.map.removeLayer("journey-arc");
  }

  if (handle.map.getSource("journey-arc")) {
    handle.map.removeSource("journey-arc");
  }
}

export function removeGameMap(handle: GameMapHandle): void {
  clearJourney(handle);
  handle.map.remove();
}

export function renderJourney(
  handle: GameMapHandle,
  figure: Figure,
  hints: JourneyHints,
  options: { animateFit: boolean; reducedMotion: boolean },
): void {
  const render = () => {
    clearJourney(handle);

    const map = handle.map;
    const birth = toLngLat(figure.coordinates_of_the_place_of_birth);
    const death = toLngLat(figure.coordinates_of_the_place_of_death);

    handle.markers = [
      new maplibregl.Marker({
        element: makeMarker("birth", hints.birth),
        anchor: "center",
      })
        .setLngLat(birth)
        .addTo(map),
      new maplibregl.Marker({
        element: makeMarker("death", hints.death),
        anchor: "center",
      })
        .setLngLat(death)
        .addTo(map),
    ];

    const arc = getCachedArc(figure);
    map.addSource("journey-arc", {
      type: "geojson",
      data: arc,
    });
    map.addLayer({
      id: "journey-arc",
      type: "line",
      source: "journey-arc",
      paint: {
        "line-color": "rgba(255, 200, 80, 0.78)",
        "line-width": 3,
        "line-dasharray": [2, 2],
        "line-blur": 0.6,
      },
    });

    const dot = document.createElement("div");
    dot.className = "moving-dot";
    handle.dotMarker = new maplibregl.Marker({ element: dot, anchor: "center" }).setLngLat(birth).addTo(map);

    const bounds: LngLatBoundsLike = [
      [Math.min(birth[0], death[0]) - 10, Math.min(birth[1], death[1]) - 10],
      [Math.max(birth[0], death[0]) + 10, Math.max(birth[1], death[1]) + 10],
    ];
    map.fitBounds(bounds, { padding: 80, maxZoom: 4.2, duration: options.animateFit ? 800 : 0 });

    const geometry = arc.geometry.coordinates;
    const animateDot = (time: number) => {
      if (geometry.length > 0 && handle.dotMarker) {
        const index = Math.floor((time / 45) % geometry.length);
        handle.dotMarker.setLngLat(geometry[index] as [number, number]);
      }
      handle.animationFrame = window.requestAnimationFrame(animateDot);
    };

    if (!options.reducedMotion) {
      handle.animationFrame = window.requestAnimationFrame(animateDot);
    }
  };

  if (handle.map.isStyleLoaded()) {
    render();
    return;
  }

  handle.map.once("styledata", render);
}
