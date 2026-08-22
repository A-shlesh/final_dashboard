import { Globe, Map } from "lucide-react";

export const OSM_STYLES: Record<string, any> = {
  "osm-standard": {
    version: 8,
    name: "OpenStreetMap Standard",
    sources: {
      "osm-raster-tiles": {
        type: "raster",
        tiles: [
          "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: "© <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors",
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: "osm-raster-layer",
        type: "raster",
        source: "osm-raster-tiles",
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  },
  "osm-satellite": {
    version: 8,
    name: "Satellite / Aerial Imagery",
    sources: {
      "satellite-tiles": {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution: "© Esri, Maxar, Earthstar Geographics, OpenStreetMap contributors",
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: "satellite-layer",
        type: "raster",
        source: "satellite-tiles",
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  },
};

export const BASEMAPS: { id: string; label: string; icon: typeof Map }[] = [
  { id: "osm-standard", label: "Map", icon: Map },
  { id: "osm-satellite", label: "Satellite", icon: Globe },
];

export function MapHud({
  styleId,
  onStyle,
}: {
  styleId: string;
  onStyle: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border/80 bg-background/90 p-1 shadow-sm backdrop-blur-md">
      {BASEMAPS.map((b) => {
        const Icon = b.icon;
        const active = styleId === b.id;
        return (
          <button
            key={b.id}
            onClick={() => onStyle(b.id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              active
                ? "bg-primary text-primary-foreground shadow-sm font-bold"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
            title={`Switch to ${b.label}`}
          >
            <Icon className="size-3.5" />
            <span>{b.label}</span>
          </button>
        );
      })}
    </div>
  );
}
