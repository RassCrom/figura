import { useEffect, useRef } from "react";

// Lazy import inside the effect so maplibre-gl stays out of the main chunk
// and the home page paints instantly even on cold load.
type MapLibreGL = typeof import("maplibre-gl");
type MapInstance = import("maplibre-gl").Map;

const WAYPOINTS: Array<[lng: number, lat: number]> = [
  [44.0, 35.0],   // Caspian / Iran
  [78.0, 27.0],   // Northern India
  [116.0, 31.0],  // East China
  [139.0, 35.0],  // Honshu
  [-43.0, -22.0], // Rio
  [-100.0, 38.0], // Central US
  [2.0, 48.0],    // Paris
  [25.0, 35.0],   // Aegean
  [30.0, -1.0],   // Equatorial Africa
];

const SEGMENT_MS = 12_000;
const ZOOM = 2.1;

export function AnimatedMapBackground() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let cancelled = false;
    let map: MapInstance | null = null;
    let timeoutId: number | null = null;
    let onVisibilityChange: (() => void) | null = null;

    void (async () => {
      // Load maplibre-gl + the basemap style only after the home screen has
      // painted — keeps the critical path JS-light.
      const [maplibregl, { getMapStyle }]: [MapLibreGL, typeof import("../lib/mapStyles")] =
        await Promise.all([
          import("maplibre-gl") as Promise<MapLibreGL>,
          import("../lib/mapStyles"),
        ]);
      if (cancelled || !containerRef.current) return;

      const startIndex = Math.floor(Math.random() * WAYPOINTS.length);
      map = new maplibregl.Map({
        container: containerRef.current,
        style: getMapStyle("Steppe"),
        center: WAYPOINTS[startIndex],
        zoom: ZOOM,
        interactive: false,
        attributionControl: false,
        fadeDuration: 0,
      });

      let cursor = startIndex;
      const step = () => {
        if (cancelled || !map) return;
        if (reducedMotion) return;
        if (document.hidden) {
          timeoutId = window.setTimeout(step, 2_000);
          return;
        }
        cursor = (cursor + 1) % WAYPOINTS.length;
        map.easeTo({
          center: WAYPOINTS[cursor],
          duration: SEGMENT_MS,
          easing: (t) => t,
        });
        timeoutId = window.setTimeout(step, SEGMENT_MS);
      };
      timeoutId = window.setTimeout(step, 800);

      onVisibilityChange = () => {
        if (!map) return;
        if (document.hidden) {
          map.stop();
        } else {
          if (timeoutId) window.clearTimeout(timeoutId);
          timeoutId = window.setTimeout(step, 600);
        }
      };
      document.addEventListener("visibilitychange", onVisibilityChange);
    })();

    return () => {
      cancelled = true;
      if (onVisibilityChange) {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      if (timeoutId) window.clearTimeout(timeoutId);
      map?.remove();
    };
  }, []);

  return <div ref={containerRef} className="home-map-bg" aria-hidden="true" />;
}
