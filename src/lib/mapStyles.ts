import type { StyleSpecification } from "maplibre-gl";

import type { Basemap } from "../types/figure";

type TileConfig = {
  tiles: string[];
  attribution: string;
};

const TILE_CONFIG: Record<Basemap, TileConfig> = {
  Steppe: {
    tiles: ["https://a.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"],
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
  },
  OSM: {
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    attribution: "&copy; OpenStreetMap contributors",
  },
  "ESRI Topo": {
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    ],
    attribution: "Tiles &copy; Esri",
  },
  "ESRI Satellite": {
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    ],
    attribution: "Tiles &copy; Esri",
  },
  "CartoDB Dark": {
    tiles: ["https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"],
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
  },
};

export function getRasterStyle(basemap: Basemap): StyleSpecification {
  const config = TILE_CONFIG[basemap];

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
      },
    ],
  };
}
