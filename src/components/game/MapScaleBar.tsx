import { useEffect, useState } from "react";
import maplibregl from "maplibre-gl";

type Props = {
  map: maplibregl.Map | null;
};

type ScaleInfo = {
  label: string;
  widthPx: number;
};

const SCALE_STEPS_KM = [
  10000, 5000, 3000, 2000, 1000, 500, 300, 200, 100, 50, 30, 20, 10, 5, 3, 2, 1,
];
const TARGET_WIDTH_PX = 100;

function computeScale(map: maplibregl.Map): ScaleInfo | null {
  const container = map.getContainer();
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (w < 1 || h < 1) return null;

  const left = map.unproject([w / 2 - TARGET_WIDTH_PX / 2, h / 2]);
  const right = map.unproject([w / 2 + TARGET_WIDTH_PX / 2, h / 2]);
  const kmPerPx = left.distanceTo(right) / 1000 / TARGET_WIDTH_PX;
  if (!isFinite(kmPerPx) || kmPerPx <= 0) return null;

  for (const stepKm of SCALE_STEPS_KM) {
    const widthPx = stepKm / kmPerPx;
    if (widthPx >= 60 && widthPx <= 180) {
      return { label: `${stepKm.toLocaleString()} km`, widthPx };
    }
  }

  const fallback = SCALE_STEPS_KM[SCALE_STEPS_KM.length - 1];
  return { label: `${fallback} km`, widthPx: Math.max(40, fallback / kmPerPx) };
}

export function MapScaleBar({ map }: Props) {
  const [scale, setScale] = useState<ScaleInfo | null>(null);

  useEffect(() => {
    if (!map) return;

    const update = () => {
      try {
        const next = computeScale(map);
        if (next) setScale(next);
      } catch {
        // map transform not ready yet — will retry on next event
      }
    };

    // Try immediately — unproject works as soon as the map has a valid
    // transform (set at construction time), no need to wait for style load.
    update();

    // Re-compute whenever the viewport changes or style reloads.
    map.on("zoom", update);
    map.on("move", update);
    map.on("idle", update);    // catches initial tile load
    map.on("styledata", update); // catches basemap switches

    return () => {
      map.off("zoom", update);
      map.off("move", update);
      map.off("idle", update);
      map.off("styledata", update);
    };
  }, [map]);

  if (!scale) return null;

  return (
    <div className="map-scale-bar" aria-label={`Map scale: ${scale.label}`}>
      <span className="scale-label">{scale.label}</span>
      <div className="scale-rule" style={{ width: scale.widthPx }}>
        <span className="scale-tick scale-tick-left" />
        <span className="scale-fill" />
        <span className="scale-tick scale-tick-right" />
      </div>
    </div>
  );
}
