import greatCircle from "@turf/great-circle";
import maplibregl, { type LngLatBoundsLike, type Marker } from "maplibre-gl";

import type { Basemap, Figure } from "../types/figure";
import { getMapStyle } from "./mapStyles";

type MarkerKind = "birth" | "death";

type MarkerHint = {
  primary: string | null;
  secondary: string | null;
};

export type JourneyHints = {
  birth: MarkerHint;
  death: MarkerHint;
};

type ArcSegment = number[][];

type JourneyCoordinates = {
  birth: [number, number];
  death: [number, number];
};

type FitPadding = number | { top: number; right: number; bottom: number; left: number };

type SafeFitOptions = {
  padding: FitPadding;
  maxZoom: number;
  duration: number;
  easing: (t: number) => number;
};

type CachedArc = {
  // One or more line segments. The antimeridian-crossing case produces 2 segments.
  segments: ArcSegment[];
  // Cumulative length, in segment-index space, for animation interpolation.
  totalPoints: number;
};

type RenderOptions = { animateFit: boolean; reducedMotion: boolean; compact?: boolean };

type PendingRender = {
  figure: Figure;
  hints: JourneyHints;
  options: RenderOptions;
};

export type RouteOverlay = {
  id: string;
  birth: [number, number];
  death: [number, number];
  color: string;
  opacity?: number;
  width?: number;
  dasharray?: number[];
};

type RouteOverlayOptions = {
  fit?: boolean;
  animateFit?: boolean;
  padding?: number;
  maxZoom?: number;
};

type PendingRouteOverlay = {
  routes: RouteOverlay[];
  options: RouteOverlayOptions;
};

export type GameMapHandle = {
  map: maplibregl.Map;
  markers: { birth: Marker; death: Marker } | null;
  dotMarker: Marker | null;
  animationFrame: number;
  currentFigureKey: string | null;
  arcStart: number;
  // Latest render intent. Always represents the most recent renderJourney
  // call. The actual render reads from here, never from a closure, so
  // rapid back-to-back calls (e.g. round transition + wrong-guess hint
  // unlock) can't be reordered or clobbered.
  pendingRender: PendingRender | null;
  // Single listener used while the style is loading. We only attach one;
  // re-entering renderJourney updates pendingRender and lets the existing
  // listener flush the latest intent when the style is ready.
  styleListener: (() => void) | null;
  routeLayerIds: Array<{ sourceId: string; layerId: string }>;
  routeOverlay: PendingRouteOverlay | null;
  pendingRouteOverlay: PendingRouteOverlay | null;
  routeOverlayStyleListener: (() => void) | null;
};

const arcCache = new Map<string, CachedArc>();
const ARC_DRAW_MS = 1400;
const PATH_FLOW_MS = 1800;
const PATH_PULSE_POINT_FRACTION = 0.18;
const POINT_FADE_OUT_MS = 220;
const COORDINATE_EPSILON = 0.000001;
const SAME_LOCATION_DEATH_OFFSET: [number, number] = [52, -46];
const JOURNEY_SOURCE_ID = "journey-arc";
const JOURNEY_PULSE_SOURCE_ID = "journey-arc-pulse";
const JOURNEY_BASE_LAYER_ID = "journey-arc";
const JOURNEY_PULSE_LAYER_ID = "journey-arc-pulse";
const ROUTE_OVERLAY_PREFIX = "journey-history-arc";

function isStyleReadyForJourney(map: maplibregl.Map): boolean {
  // MapLibre's public isStyleLoaded() waits for tile sources too. The journey
  // overlay only needs the style document to be ready for addSource/addLayer.
  return Boolean((map as maplibregl.Map & { style?: { _loaded?: boolean } }).style?._loaded);
}

function toLngLat([lat, lng]: [number, number]): [number, number] {
  return [lng, lat];
}

function coordinatesCoincide(a: [number, number], b: [number, number]): boolean {
  return Math.abs(a[0] - b[0]) < COORDINATE_EPSILON && Math.abs(a[1] - b[1]) < COORDINATE_EPSILON;
}

function getJourneyCoordinates(figure: Figure): JourneyCoordinates {
  return {
    birth: toLngLat(figure.coordinates_of_the_place_of_birth),
    death: toLngLat(figure.coordinates_of_the_place_of_death),
  };
}

function figureKey(figure: Figure): string {
  return [
    figure.first_name,
    figure.last_name,
    ...figure.coordinates_of_the_place_of_birth,
    ...figure.coordinates_of_the_place_of_death,
  ].join(":");
}

function coordinatesKey(coordinates: JourneyCoordinates): string {
  return [
    coordinates.birth[0],
    coordinates.birth[1],
    coordinates.death[0],
    coordinates.death[1],
  ].join(":");
}

// Marker DOM is built ONCE per figure with empty hint spans always present.
// Hint visibility is toggled via a .visible class — never recreated. This
// keeps the markers stable across re-renders (no flicker, no bounce
// re-trigger) and guarantees the first hint update is visible immediately.
function makeMarkerElement(kind: MarkerKind): HTMLElement {
  const element = document.createElement("div");
  element.className = `map-marker ${kind}`;
  element.setAttribute("aria-label", kind === "birth" ? "Birth location" : "Death location");
  const pinHtml = `<span class="marker-pin ${kind}-pin"><span class="marker-inner"></span></span>`;
  element.innerHTML =
    pinHtml +
    '<span class="marker-hint marker-hint-primary"></span>' +
    '<span class="marker-hint marker-hint-secondary"></span>';
  return element;
}

function setMarkerHint(element: HTMLElement, hint: MarkerHint): void {
  const primary = element.querySelector(".marker-hint-primary") as HTMLSpanElement | null;
  const secondary = element.querySelector(".marker-hint-secondary") as HTMLSpanElement | null;
  if (primary) {
    primary.textContent = hint.primary ?? "";
    primary.classList.toggle("visible", Boolean(hint.primary));
  }
  if (secondary) {
    secondary.textContent = hint.secondary ?? "";
    secondary.classList.toggle("visible", Boolean(hint.secondary));
  }
}

function addOriginConnector(element: HTMLElement, offset: [number, number]): void {
  const [offsetX, offsetY] = offset;
  const line = document.createElement("span");
  line.className = "marker-origin-line";
  line.setAttribute("aria-hidden", "true");

  element.classList.add("offset-from-origin");
  element.style.setProperty("--origin-line-length", `${Math.hypot(offsetX, offsetY)}px`);
  element.style.setProperty("--origin-line-angle", `${Math.atan2(-offsetY, -offsetX)}rad`);
  element.prepend(line);
}

function buildArcFromCoordinates(coordinates: JourneyCoordinates, cacheKey = coordinatesKey(coordinates)): CachedArc {
  const key = cacheKey;
  const cached = arcCache.get(key);
  if (cached) {
    return cached;
  }

  const { birth, death } = coordinates;
  if (coordinatesCoincide(birth, death)) {
    const value: CachedArc = { segments: [[birth, death]], totalPoints: 2 };
    arcCache.set(key, value);
    return value;
  }

  const feature = greatCircle(birth, death, { npoints: 160 }) as
    | GeoJSON.Feature<GeoJSON.LineString>
    | GeoJSON.Feature<GeoJSON.MultiLineString>;

  let segments: ArcSegment[];
  if (feature.geometry.type === "MultiLineString") {
    segments = feature.geometry.coordinates as ArcSegment[];
  } else {
    segments = [feature.geometry.coordinates as ArcSegment];
  }

  // Guarantee the line endpoints match the input lng/lat exactly so the
  // visual line meets the markers (turf can round the endpoints).
  if (segments.length > 0) {
    segments[0][0] = birth as number[];
    segments[segments.length - 1][segments[segments.length - 1].length - 1] = death as number[];
  }

  const totalPoints = segments.reduce((sum, seg) => sum + seg.length, 0);
  const value: CachedArc = { segments, totalPoints };
  arcCache.set(key, value);
  return value;
}

function buildArc(figure: Figure, coordinates: JourneyCoordinates): CachedArc {
  return buildArcFromCoordinates(coordinates, figureKey(figure));
}

function arcFeature(
  arc: CachedArc,
  fraction: number,
  coordinates?: JourneyCoordinates,
): GeoJSON.Feature<GeoJSON.MultiLineString> {
  const clamped = Math.max(0, Math.min(1, fraction));
  const targetPoints = Math.max(2, Math.round(arc.totalPoints * clamped));
  const out: ArcSegment[] = [];
  let remaining = targetPoints;
  for (const segment of arc.segments) {
    if (remaining <= 0) break;
    if (segment.length <= remaining) {
      out.push(segment);
      remaining -= segment.length;
    } else {
      out.push(segment.slice(0, remaining));
      remaining = 0;
    }
  }
  if (out.length === 0) {
    out.push([arc.segments[0][0], arc.segments[0][0]]);
  }
  if (clamped === 1 && coordinates && out.length > 0) {
    const lastSegment = out[out.length - 1];
    lastSegment[lastSegment.length - 1] = coordinates.death;
  }
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "MultiLineString",
      coordinates: out,
    },
  };
}

function dotPositionAt(arc: CachedArc, fraction: number): [number, number] {
  const clamped = Math.max(0, Math.min(0.9999, fraction));
  const targetIndex = Math.floor(arc.totalPoints * clamped);
  let cursor = 0;
  for (const segment of arc.segments) {
    if (targetIndex < cursor + segment.length) {
      return segment[targetIndex - cursor] as [number, number];
    }
    cursor += segment.length;
  }
  const lastSeg = arc.segments[arc.segments.length - 1];
  return lastSeg[lastSeg.length - 1] as [number, number];
}

function emptyArcFeature(arc: CachedArc): GeoJSON.Feature<GeoJSON.MultiLineString> {
  const first = arc.segments[0]?.[0] ?? [0, 0];
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "MultiLineString",
      coordinates: [[first, first]],
    },
  };
}

function arcPulseFeature(arc: CachedArc, elapsedMs: number): GeoJSON.Feature<GeoJSON.MultiLineString> {
  const phase = (elapsedMs % PATH_FLOW_MS) / PATH_FLOW_MS;
  const pulsePoints = Math.max(6, Math.round(arc.totalPoints * PATH_PULSE_POINT_FRACTION));
  const maxStart = Math.max(0, arc.totalPoints - pulsePoints);
  const start = Math.floor(maxStart * phase);
  const end = Math.min(arc.totalPoints - 1, start + pulsePoints);
  const out: ArcSegment[] = [];
  let cursor = 0;

  for (const segment of arc.segments) {
    const segmentStart = cursor;
    const segmentEnd = cursor + segment.length - 1;
    const from = Math.max(start, segmentStart);
    const to = Math.min(end, segmentEnd);

    if (to > from) {
      out.push(segment.slice(from - segmentStart, to - segmentStart + 1));
    }
    cursor += segment.length;
  }

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "MultiLineString",
      coordinates: out.length > 0 ? out : emptyArcFeature(arc).geometry.coordinates,
    },
  };
}

function setPathPulse(map: maplibregl.Map, arc: CachedArc, elapsedMs: number): boolean {
  const source = map.getSource(JOURNEY_PULSE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  if (!source) {
    return false;
  }
  source.setData(arcPulseFeature(arc, elapsedMs));
  return true;
}

function removeJourneyLayers(map: maplibregl.Map): void {
  if (map.getLayer(JOURNEY_PULSE_LAYER_ID)) {
    map.removeLayer(JOURNEY_PULSE_LAYER_ID);
  }
  if (map.getLayer(JOURNEY_BASE_LAYER_ID)) {
    map.removeLayer(JOURNEY_BASE_LAYER_ID);
  }
  if (map.getSource(JOURNEY_SOURCE_ID)) {
    map.removeSource(JOURNEY_SOURCE_ID);
  }
  if (map.getSource(JOURNEY_PULSE_SOURCE_ID)) {
    map.removeSource(JOURNEY_PULSE_SOURCE_ID);
  }
}

function removeRouteOverlayLayers(handle: GameMapHandle): void {
  for (const { layerId, sourceId } of [...handle.routeLayerIds].reverse()) {
    if (handle.map.getLayer(layerId)) {
      handle.map.removeLayer(layerId);
    }
    if (handle.map.getSource(sourceId)) {
      handle.map.removeSource(sourceId);
    }
  }
  handle.routeLayerIds = [];
}

function routeToCoordinates(route: RouteOverlay): JourneyCoordinates {
  return {
    birth: route.birth,
    death: route.death,
  };
}

function fitRoutes(map: maplibregl.Map, routes: RouteOverlay[], options: RouteOverlayOptions): void {
  if (!options.fit || routes.length === 0) {
    return;
  }

  const bounds = new maplibregl.LngLatBounds();
  for (const route of routes) {
    bounds.extend(route.birth);
    bounds.extend(route.death);
  }

  fitBoundsSafely(map, bounds, {
    padding: options.padding ?? 58,
    maxZoom: options.maxZoom ?? 3.8,
    duration: options.animateFit ? 900 : 0,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
}

function fitBoundsSafely(map: maplibregl.Map, bounds: LngLatBoundsLike, options: SafeFitOptions): void {
  const { clientWidth, clientHeight } = map.getContainer();
  if (clientWidth < 40 || clientHeight < 40) {
    return;
  }

  if (typeof options.padding === "number") {
    const maxPadding = Math.max(0, Math.floor((Math.min(clientWidth, clientHeight) - 24) / 2));
    map.fitBounds(bounds, { ...options, padding: Math.min(options.padding, maxPadding) });
    return;
  }

  const horizontalPadding = options.padding.left + options.padding.right;
  const verticalPadding = options.padding.top + options.padding.bottom;
  const scale = Math.min(
    1,
    horizontalPadding > 0 ? (clientWidth - 24) / horizontalPadding : 1,
    verticalPadding > 0 ? (clientHeight - 24) / verticalPadding : 1,
  );
  const padding =
    scale >= 1
      ? options.padding
      : {
          top: Math.max(0, Math.floor(options.padding.top * scale)),
          right: Math.max(0, Math.floor(options.padding.right * scale)),
          bottom: Math.max(0, Math.floor(options.padding.bottom * scale)),
          left: Math.max(0, Math.floor(options.padding.left * scale)),
        };

  map.fitBounds(bounds, { ...options, padding });
}

function removeMarker(marker: Marker, fade: boolean): void {
  if (!fade) {
    marker.remove();
    return;
  }

  marker.getElement().classList.add("fading-away");
  window.setTimeout(() => marker.remove(), POINT_FADE_OUT_MS);
}

export function createGameMap(container: HTMLElement, basemap: Basemap): GameMapHandle {
  const map = new maplibregl.Map({
    container,
    style: getMapStyle(basemap),
    center: [45, 35],
    zoom: 1.3,
    attributionControl: false,
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

  return {
    map,
    markers: null,
    dotMarker: null,
    animationFrame: 0,
    currentFigureKey: null,
    arcStart: 0,
    pendingRender: null,
    styleListener: null,
    routeLayerIds: [],
    routeOverlay: null,
    pendingRouteOverlay: null,
    routeOverlayStyleListener: null,
  };
}

export function setBasemap(handle: GameMapHandle, basemap: Basemap): void {
  // setStyle wipes sources and layers (the arc), so force the journey to
  // be rebuilt on the next renderJourney call. Without this, the line
  // disappears after a basemap change because the same-figure path would
  // skip recreation.
  const routeOverlay = handle.routeOverlay;
  handle.currentFigureKey = null;
  removeJourneyLayers(handle.map);
  removeRouteOverlayLayers(handle);
  handle.map.setStyle(getMapStyle(basemap));
  if (routeOverlay) {
    renderRouteOverlay(handle, routeOverlay.routes, routeOverlay.options);
  }
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

export function clearJourney(handle: GameMapHandle, fadePoints = true): void {
  window.cancelAnimationFrame(handle.animationFrame);
  handle.animationFrame = 0;
  if (handle.markers) {
    removeMarker(handle.markers.birth, fadePoints);
    removeMarker(handle.markers.death, fadePoints);
    handle.markers = null;
  }
  if (handle.dotMarker) {
    removeMarker(handle.dotMarker, fadePoints);
  }
  handle.dotMarker = null;
  handle.currentFigureKey = null;

  removeJourneyLayers(handle.map);
}

export function removeGameMap(handle: GameMapHandle): void {
  if (handle.styleListener) {
    handle.map.off("styledata", handle.styleListener);
    handle.map.off("load", handle.styleListener);
    handle.styleListener = null;
  }
  if (handle.routeOverlayStyleListener) {
    handle.map.off("styledata", handle.routeOverlayStyleListener);
    handle.map.off("load", handle.routeOverlayStyleListener);
    handle.routeOverlayStyleListener = null;
  }
  handle.pendingRender = null;
  handle.pendingRouteOverlay = null;
  clearJourney(handle, false);
  removeRouteOverlayLayers(handle);
  handle.map.remove();
}

export function renderJourney(
  handle: GameMapHandle,
  figure: Figure,
  hints: JourneyHints,
  options: RenderOptions,
): void {
  // Always overwrite the latest intent. Stale closures from earlier calls
  // can never resurface — the flush always reads what's most recent here.
  handle.pendingRender = { figure, hints, options };

  if (isStyleReadyForJourney(handle.map)) {
    flushPending(handle);
    return;
  }

  // Style is still loading. Attach a listener exactly once. When the style
  // is finally loaded we flush whatever pendingRender holds at THAT moment,
  // not what was passed to this call.
  if (handle.styleListener) {
    return;
  }

  const listener = () => {
    if (!isStyleReadyForJourney(handle.map)) {
      return; // styledata fires multiple times during load; wait for ready
    }
    handle.map.off("styledata", listener);
    handle.map.off("load", listener);
    handle.styleListener = null;
    flushPending(handle);
  };
  handle.styleListener = listener;
  handle.map.on("styledata", listener);
  handle.map.on("load", listener);
}

export function renderRouteOverlay(
  handle: GameMapHandle,
  routes: RouteOverlay[],
  options: RouteOverlayOptions = {},
): void {
  handle.pendingRouteOverlay = { routes, options };

  if (isStyleReadyForJourney(handle.map)) {
    flushPendingRouteOverlay(handle);
    return;
  }

  if (handle.routeOverlayStyleListener) {
    return;
  }

  const listener = () => {
    if (!isStyleReadyForJourney(handle.map)) {
      return;
    }
    handle.map.off("styledata", listener);
    handle.map.off("load", listener);
    handle.routeOverlayStyleListener = null;
    flushPendingRouteOverlay(handle);
  };
  handle.routeOverlayStyleListener = listener;
  handle.map.on("styledata", listener);
  handle.map.on("load", listener);
}

export function focusJourney(
  handle: GameMapHandle,
  figure: Figure,
  options: { reducedMotion: boolean; compact?: boolean } = { reducedMotion: false },
): void {
  const { birth, death } = getJourneyCoordinates(figure);
  const bounds: LngLatBoundsLike = [
    [Math.min(birth[0], death[0]) - 8, Math.min(birth[1], death[1]) - 8],
    [Math.max(birth[0], death[0]) + 8, Math.max(birth[1], death[1]) + 8],
  ];

  fitBoundsSafely(handle.map, bounds, {
    padding: options.compact
      ? { top: 28, right: 28, bottom: 28, left: 28 }
      : { top: 96, right: 64, bottom: 220, left: 64 },
    maxZoom: options.compact ? 2.7 : 4.5,
    duration: options.reducedMotion ? 0 : 850,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
}

function flushPending(handle: GameMapHandle): void {
  const pending = handle.pendingRender;
  if (!pending) {
    return;
  }
  // Clear the slot before rendering so concurrent renderJourney calls
  // during the synchronous render path can safely re-queue themselves.
  handle.pendingRender = null;
  doRender(handle, pending.figure, pending.hints, pending.options);
}

function flushPendingRouteOverlay(handle: GameMapHandle): void {
  const pending = handle.pendingRouteOverlay;
  if (!pending) {
    return;
  }
  handle.pendingRouteOverlay = null;
  doRenderRouteOverlay(handle, pending.routes, pending.options);
}

function doRenderRouteOverlay(
  handle: GameMapHandle,
  routes: RouteOverlay[],
  options: RouteOverlayOptions,
): void {
  removeRouteOverlayLayers(handle);
  handle.routeOverlay = { routes, options };

  if (routes.length === 0) {
    return;
  }

  const map = handle.map;
  const beforeId = map.getLayer(JOURNEY_BASE_LAYER_ID) ? JOURNEY_BASE_LAYER_ID : undefined;
  routes.forEach((route, index) => {
    const coordinates = routeToCoordinates(route);
    const arc = buildArcFromCoordinates(coordinates, `route:${route.id}:${coordinatesKey(coordinates)}`);
    const sourceId = `${ROUTE_OVERLAY_PREFIX}-source-${index}`;
    const layerId = `${ROUTE_OVERLAY_PREFIX}-layer-${index}`;

    map.addSource(sourceId, { type: "geojson", data: arcFeature(arc, 1, coordinates) });
    map.addLayer(
      {
        id: layerId,
        type: "line",
        source: sourceId,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": route.color,
          "line-width": route.width ?? 2,
          "line-opacity": route.opacity ?? 0.3,
          "line-blur": 0.35,
          ...(route.dasharray ? { "line-dasharray": route.dasharray } : {}),
        },
      },
      beforeId,
    );
    handle.routeLayerIds.push({ sourceId, layerId });
  });

  fitRoutes(map, routes, options);
}

function doRender(
  handle: GameMapHandle,
  figure: Figure,
  hints: JourneyHints,
  options: RenderOptions,
): void {
  const map = handle.map;
  const key = figureKey(figure);

  // Same figure: update hint contents without rebuilding markers
  // (prevents marker bounce + visual drift on re-render).
  if (handle.currentFigureKey === key && handle.markers) {
    setMarkerHint(handle.markers.birth.getElement(), hints.birth);
    setMarkerHint(handle.markers.death.getElement(), hints.death);
    return;
  }

  // New figure: tear down and rebuild.
  clearJourney(handle);
  handle.currentFigureKey = key;

  const coordinates = getJourneyCoordinates(figure);
  const { birth, death } = coordinates;

  const birthElement = makeMarkerElement("birth");
  const deathElement = makeMarkerElement("death");
  setMarkerHint(birthElement, hints.birth);
  setMarkerHint(deathElement, hints.death);
  const sameLocation = coordinatesCoincide(birth, death);
  const deathOffset: [number, number] = sameLocation ? SAME_LOCATION_DEATH_OFFSET : [0, 0];
  if (sameLocation) {
    addOriginConnector(deathElement, SAME_LOCATION_DEATH_OFFSET);
  }

  handle.markers = {
    birth: new maplibregl.Marker({ element: birthElement, anchor: "center", subpixelPositioning: true })
      .setLngLat(birth)
      .addTo(map),
    death: new maplibregl.Marker({
      element: deathElement,
      anchor: "center",
      offset: deathOffset,
      subpixelPositioning: true,
    })
      .setLngLat(death)
      .addTo(map),
  };

  const arc = buildArc(figure, coordinates);
  const initialFeature =
    options.reducedMotion || sameLocation ? arcFeature(arc, 1, coordinates) : arcFeature(arc, 0);

  map.addSource(JOURNEY_SOURCE_ID, { type: "geojson", data: initialFeature });
  map.addLayer({
    id: JOURNEY_BASE_LAYER_ID,
    type: "line",
    source: JOURNEY_SOURCE_ID,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "rgba(255, 200, 80, 0.85)",
      "line-width": 3,
      "line-dasharray": [2, 2],
      "line-blur": 0.5,
    },
  });
  if (!options.reducedMotion && !sameLocation) {
    map.addSource(JOURNEY_PULSE_SOURCE_ID, { type: "geojson", data: emptyArcFeature(arc) });
    map.addLayer({
      id: JOURNEY_PULSE_LAYER_ID,
      type: "line",
      source: JOURNEY_PULSE_SOURCE_ID,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "rgba(255, 246, 202, 0.92)",
        "line-width": 6,
        "line-blur": 1.2,
        "line-opacity": 0.95,
      },
    });
  }

  const dot = document.createElement("div");
  dot.className = "moving-dot";
  handle.dotMarker = new maplibregl.Marker({
    element: dot,
    anchor: "center",
    offset: sameLocation ? SAME_LOCATION_DEATH_OFFSET : [0, 0],
    subpixelPositioning: true,
  })
    .setLngLat(birth)
    .addTo(map);

  const bounds: LngLatBoundsLike = [
    [Math.min(birth[0], death[0]) - 10, Math.min(birth[1], death[1]) - 10],
    [Math.max(birth[0], death[0]) + 10, Math.max(birth[1], death[1]) + 10],
  ];
  fitBoundsSafely(map, bounds, {
    padding: options.compact ? 24 : 80,
    maxZoom: options.compact ? 2.8 : 4.2,
    duration: options.animateFit ? 1300 : 0,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });

  if (options.reducedMotion || sameLocation) {
    handle.dotMarker.setLngLat(death);
    dot.classList.add("arrived");
    return;
  }

  handle.arcStart = performance.now();
  const source = map.getSource(JOURNEY_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  const dotElement = handle.dotMarker.getElement();

  const pulseFrame = (now: number) => {
    if (!setPathPulse(map, arc, now - handle.arcStart)) {
      handle.animationFrame = 0;
      return;
    }
    handle.animationFrame = window.requestAnimationFrame(pulseFrame);
  };

  const frame = (now: number) => {
    if (!handle.dotMarker || !source) {
      return;
    }
    const elapsed = now - handle.arcStart;
    const drawProgress = Math.min(1, elapsed / ARC_DRAW_MS);
    const easedDraw = 1 - Math.pow(1 - drawProgress, 3); // ease-out cubic
    source.setData(arcFeature(arc, easedDraw, coordinates));

    // The dot follows the head of the line as it draws (birth → death),
    // then settles at the death endpoint. The previous behavior — looping
    // birth→death forever — read as decorative noise that competed with
    // the static markers and overlapped their hint labels. A one-shot
    // arrival reads as the figure's journey completing.
    handle.dotMarker.setLngLat(dotPositionAt(arc, easedDraw));

    if (drawProgress >= 1) {
      source.setData(arcFeature(arc, 1, coordinates));
      // Pin the dot exactly at the death endpoint and mark it arrived so
      // CSS can switch from "traveling" (bright glow) to "arrived"
      // (smaller, dimmer rest state).
      handle.dotMarker.setLngLat(death);
      dotElement.classList.add("arrived");
      handle.animationFrame = window.requestAnimationFrame(pulseFrame);
      return;
    }

    handle.animationFrame = window.requestAnimationFrame(frame);
  };

  handle.animationFrame = window.requestAnimationFrame(frame);
}
