import type { StyleSpecification } from "maplibre-gl";

import type { Basemap } from "../types/figure";
import customVectorStyle from "./customVectorStyle.json";

type TileConfig = {
  type: "raster";
  tiles: string[];
  attribution: string;
  hueRotate?: number;
  saturate?: number;
  brightnessMax?: number;
  contrast?: number;
} | {
  type: "vector";
  style: any;
};

const TILE_CONFIG: Record<Basemap, TileConfig> = {
  Steppe: {
    type: "raster",
    tiles: ["https://a.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"],
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
  },
  OSM: {
    type: "raster",
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    attribution: "&copy; OpenStreetMap contributors",
  },
  "ESRI Topo": {
    type: "raster",
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    ],
    attribution: "Tiles &copy; Esri",
  },
  "ESRI Satellite": {
    type: "raster",
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    ],
    attribution: "Tiles &copy; Esri",
  },
  "CartoDB Dark": {
    type: "raster",
    tiles: ["https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"],
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
  },
  "Dark Night Blue": {
    type: "raster",
    tiles: ["https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"],
    attribution: "Stadia Maps",
    brightnessMax: 0.8,
    saturate: 0.2
  },
  Historic: {
    type: "raster",
    tiles: ["https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg"],
    attribution: "Stadia Maps",
    contrast: 0.1,
    saturate: -0.2
  },
  "Custom Vector": {
    type: "vector",
    style: customVectorStyle
  }
};

export function getMapStyle(basemap: Basemap): StyleSpecification {
  const config = TILE_CONFIG[basemap];

  if (config.type === "vector") {
    return config.style as StyleSpecification;
  }

  const paint: any = {};
  if (config.hueRotate !== undefined) paint["raster-hue-rotate"] = config.hueRotate;
  if (config.saturate !== undefined) paint["raster-saturation"] = config.saturate;
  if (config.brightnessMax !== undefined) paint["raster-brightness-max"] = config.brightnessMax;
  if (config.contrast !== undefined) paint["raster-contrast"] = config.contrast;

  return {
    version: 8,
    sources: {
      base: {
        type: "raster",
        tiles: config.tiles,
        tileSize: 256,
        attribution: config.attribution,
      },
    },
    layers: [
      {
        id: "base",
        type: "raster",
        source: "base",
        paint,
      },
    ],
  };
}
