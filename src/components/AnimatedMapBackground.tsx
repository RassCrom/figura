import { useEffect, useRef } from "react";

import type { FeaturedFigure } from "../types/figure";

type MapLibreGL = typeof import("maplibre-gl");
type MapInstance = import("maplibre-gl").Map;

const ROTATION_DEGREES_PER_SECOND = 1.8;
const ROTATION_SEGMENT_DEGREES = 54;
const ROTATION_SEGMENT_DURATION_MS =
  (ROTATION_SEGMENT_DEGREES / ROTATION_DEGREES_PER_SECOND) * 1_000;
const START_CENTER: [lng: number, lat: number] = [42, 18];
const FEATURED_FIGURE_COUNT = 20;

type Props = {
  figures: FeaturedFigure[];
};

function createBirthplaceMarker(figure: FeaturedFigure, rank: number): HTMLDivElement {
  const marker = document.createElement("div");
  marker.className = `birthplace-marker${rank <= 3 ? " birthplace-marker--headliner" : ""}`;
  marker.style.setProperty("--marker-delay", `${(rank % 7) * -0.46}s`);
  marker.title = `${rank}. ${figure.first_name} ${figure.last_name} - born in ${figure.place_of_birth}`;

  const body = document.createElement("div");
  body.className = "birthplace-marker-body";

  const medallion = document.createElement("div");
  medallion.className = "birthplace-marker-medallion";

  const initials = document.createElement("span");
  initials.className = "birthplace-marker-initials";
  initials.textContent = `${figure.first_name[0] ?? ""}${figure.last_name[0] ?? ""}`;

  const portrait = document.createElement("img");
  portrait.className = "birthplace-marker-portrait";
  portrait.src = figure.photo;
  portrait.alt = "";
  portrait.loading = "lazy";
  portrait.addEventListener("error", () => portrait.remove(), { once: true });

  const rankTab = document.createElement("span");
  rankTab.className = "birthplace-marker-rank";
  rankTab.textContent = String(rank);

  const pin = document.createElement("span");
  pin.className = "birthplace-marker-pin";

  medallion.append(initials, portrait, rankTab);
  body.append(medallion, pin);
  marker.append(body);
  return marker;
}

export function AnimatedMapBackground({ figures }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let cancelled = false;
    let map: MapInstance | null = null;
    let rotationFrame: number | null = null;
    let onMoveEnd: (() => void) | null = null;
    let onVisibilityChange: (() => void) | null = null;

    void (async () => {
      const [maplibregl, { getMapStyle }]: [MapLibreGL, typeof import("../lib/mapStyles")] =
        await Promise.all([import("maplibre-gl") as Promise<MapLibreGL>, import("../lib/mapStyles")]);
      if (cancelled || !containerRef.current) return;

      map = new maplibregl.Map({
        container: containerRef.current,
        style: getMapStyle("Steppe"),
        center: START_CENTER,
        zoom: 1.35,
        minZoom: 1,
        maxZoom: 2,
        interactive: false,
        attributionControl: false,
        fadeDuration: 0,
        renderWorldCopies: false,
        refreshExpiredTiles: false,
      });

      [...figures]
        .sort((first, second) => second.popularity_rating - first.popularity_rating)
        .slice(0, FEATURED_FIGURE_COUNT)
        .forEach((figure, index) => {
          const [lat, lng] = figure.coordinates_of_the_place_of_birth;
          new maplibregl.Marker({
            element: createBirthplaceMarker(figure, index + 1),
            anchor: "bottom",
          })
            .setLngLat([lng, lat])
            .addTo(map!);
        });

      const rotate = () => {
        rotationFrame = null;
        if (cancelled || !map || reducedMotion || document.hidden || map.isMoving()) return;
        const center = map.getCenter();
        map.easeTo({
          center: [center.lng - ROTATION_SEGMENT_DEGREES, center.lat],
          duration: ROTATION_SEGMENT_DURATION_MS,
          easing: (progress) => progress,
          essential: false,
        });
      };

      onMoveEnd = () => {
        if (cancelled || reducedMotion || document.hidden) return;
        rotationFrame = window.requestAnimationFrame(rotate);
      };
      map.on("moveend", onMoveEnd);
      if (!reducedMotion) {
        map.once("idle", () => {
          rotationFrame = window.requestAnimationFrame(rotate);
        });
      }

      onVisibilityChange = () => {
        if (!map) return;
        if (document.hidden) {
          if (rotationFrame !== null) window.cancelAnimationFrame(rotationFrame);
          rotationFrame = null;
          map.stop();
        } else if (!reducedMotion && rotationFrame === null) {
          rotationFrame = window.requestAnimationFrame(rotate);
        }
      };
      document.addEventListener("visibilitychange", onVisibilityChange);
    })();

    return () => {
      cancelled = true;
      if (onVisibilityChange) document.removeEventListener("visibilitychange", onVisibilityChange);
      if (rotationFrame !== null) window.cancelAnimationFrame(rotationFrame);
      if (onMoveEnd) map?.off("moveend", onMoveEnd);
      map?.remove();
    };
  }, [figures]);

  return (
    <div className="home-globe-bg" aria-hidden="true">
      <div className="home-globe">
        <div ref={containerRef} className="home-globe-map" />
        <div className="home-globe-shade" />
      </div>
      <div className="home-globe-haze" />
    </div>
  );
}
