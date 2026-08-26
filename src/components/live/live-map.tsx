import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  CELL_COLOR,
  clamp,
  generateCellSensorData,
  strHash,
  ZONES,
  type GridSensorData,
  type LakeEntity,
} from "@/lib/water-data";
import { OSM_STYLES } from "./map-hud";
import { fetchOsmWaterBody } from "@/lib/osm-water-service";


export type MapHandle = {
  flyTo: (lng: number, lat: number, zoom?: number) => void;
};

const TOKEN =
  (import.meta.env["VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN"] as string) ||
  (import.meta.env["VITE_MAPBOX_TOKEN"] as string) ||
  (import.meta.env["VITE_MAPBOX_ACCESS_TOKEN"] as string) ||
  (import.meta.env["VITE_MAP_TOKEN"] as string);

if (!TOKEN) {
  throw new Error("Missing Mapbox token");
}

const ENV_MAP_STYLE =
  (import.meta.env["VITE_MAP_STYLE_URL"] as string) ||
  (import.meta.env["VITE_MAP_STYLE"] as string) ||
  (import.meta.env["VITE_MAP_LINK"] as string) ||
  (import.meta.env["VITE_MAPBOX_STYLE"] as string);


type GridResult = {
  boundary: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
  cells: GridSensorData[];
};

export type HeatmapMode = "status" | "tds" | "turbidity" | "ph" | "temp" | "wqi";

export function getGridMetric(grid: GridSensorData, mode: HeatmapMode) {
  switch (mode) {
    case "tds": {
      const v = grid.tds;
      let color = "#06b6d4"; // <250
      if (v >= 500) color = "#ef4444";
      else if (v >= 350) color = "#f59e0b";
      else if (v >= 250) color = "#10b981";
      return { color, label: `${v} ppm` };
    }
    case "turbidity": {
      const v = grid.turbidity;
      let color = "#06b6d4"; // <8
      if (v >= 25) color = "#ef4444";
      else if (v >= 15) color = "#f59e0b";
      else if (v >= 8) color = "#10b981";
      return { color, label: `${v} NTU` };
    }
    case "ph": {
      const v = grid.ph;
      let color = "#10b981";
      if (v < 6.5) color = "#f43f5e";
      else if (v > 8.5) color = "#a855f7";
      else if (v > 7.6) color = "#06b6d4";
      return { color, label: `pH ${v}` };
    }
    case "temp": {
      const v = grid.dhtTemp;
      let color = "#06b6d4";
      if (v >= 32) color = "#ef4444";
      else if (v >= 28) color = "#f59e0b";
      else if (v >= 24) color = "#10b981";
      return { color, label: `${v}°C` };
    }
    case "wqi": {
      const v = grid.waterHealthIndex;
      let color = "#10b981";
      if (v < 40) color = "#ef4444";
      else if (v < 60) color = "#f59e0b";
      else if (v < 80) color = "#06b6d4";
      return { color, label: `${v}/100` };
    }
    case "status":
    default:
      return { color: grid.color, label: grid.state.toUpperCase() };
  }
}

export default function LiveMap({
  lakes,
  selectedLake,
  selectedGridId,
  robotLocation,
  onSelectLake,
  onSelectGrid,
  registerHandle,
  styleId,
  isDetectingWater,
  isEditingBoundary,
  onWaterDetected,
  onSaveCustomBoundary,
  onCancelEditBoundary,
}: {
  lakes: LakeEntity[];
  selectedLake: LakeEntity | null;
  selectedGridId: string | null;
  robotLocation?: { lat: number; lng: number; compass: number; name?: string } | null;
  onSelectLake: (lake: LakeEntity | null) => void;
  onSelectGrid: (grid: GridSensorData | null) => void;
  registerHandle: (handle: MapHandle | null) => void;
  styleId: string;
  isDetectingWater: boolean;
  isEditingBoundary: boolean;
  onWaterDetected: (detected: {
    name: string;
    zone: string;
    lng: number;
    lat: number;
    areaHa: number;
    boundary: [number, number][];
  }) => void;
  onSaveCustomBoundary: (
    lakeId: string,
    boundaryPoints: [number, number][],
    name: string,
    zone: string,
  ) => void;
  onCancelEditBoundary: () => void;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const lakeMarkers = useRef<Record<string, mapboxgl.Marker>>({});
  const robotMarker = useRef<mapboxgl.Marker | null>(null);
  const gridCache = useRef<Record<string, GridResult>>({});
  const activeLakeGrids = useRef<Set<string>>(new Set());

  // Heatmap View Mode State
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>("status");
  const heatmapModeRef = useRef(heatmapMode);
  heatmapModeRef.current = heatmapMode;

  // Boundary editing state & editable name/zone
  const [editVertices, setEditVertices] = useState<[number, number][]>([]);
  const [editName, setEditName] = useState("");
  const [editZone, setEditZone] = useState("South");
  const vertexMarkers = useRef<mapboxgl.Marker[]>([]);
  const [detectionNotice, setDetectionNotice] = useState<string | null>(null);

  const selectedLakeRef = useRef(selectedLake);
  const selectedGridRef = useRef(selectedGridId);
  const isDetectingRef = useRef(isDetectingWater);
  const isEditingRef = useRef(isEditingBoundary);
  const lakesRef = useRef(lakes);

  selectedLakeRef.current = selectedLake;
  selectedGridRef.current = selectedGridId;
  isDetectingRef.current = isDetectingWater;
  isEditingRef.current = isEditingBoundary;
  lakesRef.current = lakes;

  function getWaterLayerIds(map: mapboxgl.Map) {
    const layers = map.getStyle()?.layers ?? [];
    return layers
      .filter((l) => /water|ocean|river|lake|reservoir/i.test(l.id) && l.type === "fill")
      .map((l) => l.id);
  }

  function getWaterLabelLayerIds(map: mapboxgl.Map) {
    const layers = map.getStyle()?.layers ?? [];
    return layers
      .filter((l) => /water.*name|water.*label|natural.*label|poi/i.test(l.id))
      .map((l) => l.id);
  }

  // ---------------- Map Initialization ----------------
  useEffect(() => {
    if (!container.current || mapRef.current) return;
    mapboxgl.accessToken = TOKEN;
    const styleDef = OSM_STYLES[styleId] || styleId;
    const map = new mapboxgl.Map({
      container: container.current,
      style: OSM_STYLES[styleId] || OSM_STYLES["osm-standard"],
      center: [77.5600, 12.9350],
      zoom: 12.2,
      attributionControl: true,
    });
    mapRef.current = map;
    map.keyboard.disable(); // Free arrow keys for dashboard button navigation

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "bottom-right");
    map.addControl(new mapboxgl.ScaleControl({ maxWidth: 110, unit: "metric" }), "bottom-right");

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container.current);

    registerHandle({
      flyTo: (lng, lat, zoom = 15.2) => map.flyTo({ center: [lng, lat], zoom, duration: 1100 }),
    });

    map.on("load", () => {
      map.resize();
      initBoundaryDrawingSource(map);
    });

    // ---------------- Map Click Handler ----------------
    map.on("click", (e) => {
      // 1. If currently in boundary vertex editing mode, click adds a vertex
      if (isEditingRef.current) {
        setEditVertices((prev) => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
        return;
      }

      // 2. ONLY if user explicitly clicked "+ Add Lake"
      if (isDetectingRef.current) {
        detectWaterBodyAtPoint(map, e.point, [e.lngLat.lng, e.lngLat.lat]);
        return;
      }

      // 3. Check if user clicked on any existing registered lake
      const clickedLake = findRegisteredLakeAtPoint(e.lngLat.lng, e.lngLat.lat);
      if (clickedLake) {
        onSelectLake(clickedLake);
        onSelectGrid(null);
        map.flyTo({ center: [clickedLake.lng, clickedLake.lat], zoom: 15.2, duration: 1000 });
        return;
      }

      // 4. Regular map navigation / click outside
      onSelectLake(null);
      onSelectGrid(null);
    });

    return () => {
      ro.disconnect();
      registerHandle(null);
      map.remove();
      mapRef.current = null;
      lakeMarkers.current = {};
      gridCache.current = {};
      activeLakeGrids.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function findRegisteredLakeAtPoint(lng: number, lat: number): LakeEntity | null {
    const pt = turf.point([lng, lat]);
    for (const lake of lakesRef.current) {
      if (lake.boundary && lake.boundary.length >= 3) {
        try {
          const poly = turf.polygon([[...lake.boundary, lake.boundary[0]!]]);
          if (turf.booleanPointInPolygon(pt, poly)) return lake;
        } catch {
          /* noop */
        }
      }
      const d = Math.sqrt((lake.lng - lng) ** 2 + (lake.lat - lat) ** 2);
      if (d < 0.008) return lake;
    }
    return null;
  }

  /**
   * REAL ACCURATE OPENSTREETMAP WATER BODY DETECTION CENTERED AT CURSOR POINT
   */
  async function detectWaterBodyAtPoint(map: mapboxgl.Map, point: mapboxgl.Point, lngLat: [number, number]) {
    setDetectionNotice("Querying OpenStreetMap real shoreline...");

    try {
      // 1. Direct query to OpenStreetMap Overpass database for the exact official lake polygon!
      const osmWater = await fetchOsmWaterBody(lngLat[0], lngLat[1]);
      if (osmWater && osmWater.boundary.length >= 3) {
        setDetectionNotice(`Real OpenStreetMap shoreline loaded for "${osmWater.name}" (${osmWater.boundary.length} vertices)`);
        setTimeout(() => setDetectionNotice(null), 3500);

        onWaterDetected({
          name: osmWater.name,
          zone: osmWater.zone,
          lng: lngLat[0],
          lat: lngLat[1],
          areaHa: osmWater.areaHa,
          boundary: osmWater.boundary,
        });

        map.flyTo({ center: [lngLat[0], lngLat[1]], zoom: 15.6, duration: 800 });
        return;
      }
    } catch (err) {
      console.warn("[scrub] OSM Overpass lookup error", err);
    }

    setDetectionNotice("Custom lake location. Click around the shoreline to add vertices or drag points.");
    setTimeout(() => setDetectionNotice(null), 4000);

    // 2. Fallback: Place clean initial polygon centered at cursor for manual outline
    const dLat = 0.0010;
    const dLng = 0.0014;
    const initialPerimeter: [number, number][] = [
      [lngLat[0], lngLat[1] + dLat],
      [lngLat[0] + dLng * 0.9, lngLat[1] + dLat * 0.5],
      [lngLat[0] + dLng * 0.9, lngLat[1] - dLat * 0.5],
      [lngLat[0], lngLat[1] - dLat],
      [lngLat[0] - dLng * 0.9, lngLat[1] - dLat * 0.5],
      [lngLat[0] - dLng * 0.9, lngLat[1] + dLat * 0.5],
    ];

    onWaterDetected({
      name: `Water Body @ ${lngLat[1].toFixed(4)}, ${lngLat[0].toFixed(4)}`,
      zone: "South",
      lng: lngLat[0],
      lat: lngLat[1],
      areaHa: 8.5,
      boundary: initialPerimeter,
    });

    map.flyTo({ center: [lngLat[0], lngLat[1]], zoom: 15.6, duration: 800 });
  }

  // ---------------- Style Switching ----------------
  const initialStyle = useRef(styleId);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || styleId === initialStyle.current) return;
    initialStyle.current = styleId;
    cleanupAllGrids();
    gridCache.current = {};
    const styleDef = OSM_STYLES[styleId] || styleId;
    map.setStyle(styleDef);
    map.once("style.load", () => {
      initBoundaryDrawingSource(map);
      if (selectedLakeRef.current) {
        renderLakeGrids(selectedLakeRef.current);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleId]);

  // ---------------- Lake Markers on Basemap ----------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const ids = new Set(lakes.map((l) => l.id));
    Object.entries(lakeMarkers.current).forEach(([id, m]) => {
      if (!ids.has(id)) {
        m.remove();
        delete lakeMarkers.current[id];
      }
    });

    lakes.forEach((lake) => {
      if (lakeMarkers.current[lake.id]) return;

      const el = document.createElement("div");
      el.className =
        "flex size-5 items-center justify-center rounded-full border-2 border-white bg-primary text-white shadow-lg cursor-pointer transition-transform hover:scale-125";
      el.innerHTML = `<span class="size-2 rounded-full bg-white"></span>`;
      el.title = `${lake.name} — Click to inspect`;

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectLake(lake);
        onSelectGrid(null);
        map.flyTo({ center: [lake.lng, lake.lat], zoom: 15.2, duration: 1000 });
      });

      lakeMarkers.current[lake.id] = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([lake.lng, lake.lat])
        .addTo(map);
    });
  }, [lakes, onSelectLake, onSelectGrid]);

  // ---------------- Selection & Grid Sync ----------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedLake) {
      renderLakeGrids(selectedLake);
      const m = lakeMarkers.current[selectedLake.id];
      if (m) m.getElement().style.display = "none";
    } else {
      cleanupAllGrids();
      Object.values(lakeMarkers.current).forEach((m) => {
        m.getElement().style.display = "";
      });
    }
  }, [selectedLake]);

  // ---------------- Live Robot Position Marker Sync ----------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (robotLocation) {
      if (!robotMarker.current) {
        const el = document.createElement("div");
        el.className = "relative flex items-center justify-center cursor-pointer";
        el.title = `SCRUB Robot: ${robotLocation.lat.toFixed(5)}, ${robotLocation.lng.toFixed(5)} · ${robotLocation.compass}°`;
        el.innerHTML = `
          <div class="absolute size-9 rounded-full bg-cyan-400/30 animate-ping"></div>
          <div class="relative flex size-7 items-center justify-center rounded-full border-2 border-white bg-cyan-500 shadow-2xl text-white font-bold">
            <svg class="size-4 transition-transform duration-300" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" style="transform: rotate(${robotLocation.compass}deg);">
              <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
            </svg>
          </div>
        `;
        robotMarker.current = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([robotLocation.lng, robotLocation.lat])
          .addTo(map);
      } else {
        robotMarker.current.setLngLat([robotLocation.lng, robotLocation.lat]);
        const svg = robotMarker.current.getElement().querySelector("svg");
        if (svg) svg.style.transform = `rotate(${robotLocation.compass}deg)`;
      }
    } else {
      if (robotMarker.current) {
        robotMarker.current.remove();
        robotMarker.current = null;
      }
    }
  }, [robotLocation]);

  // ---------------- Selected Grid Cell Highlight ----------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedLake || !map.isStyleLoaded()) return;

    const lineId = `lake-grid-line-${selectedLake.id}`;
    if (map.getLayer(lineId)) {
      if (selectedGridId) {
        map.setPaintProperty(lineId, "line-width", [
          "case",
          ["==", ["get", "id"], selectedGridId],
          3.5,
          1.2,
        ]);
        map.setPaintProperty(lineId, "line-color", [
          "case",
          ["==", ["get", "id"], selectedGridId],
          "#ffffff",
          ["get", "color"],
        ]);
      } else {
        map.setPaintProperty(lineId, "line-width", 1.2);
        map.setPaintProperty(lineId, "line-color", ["get", "color"]);
      }
    }
  }, [selectedGridId, selectedLake]);

  // ---------------- Precision Crosshair Cursor on Add Lake ----------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const canvas = map.getCanvas();
    if (!canvas) return;

    if (isDetectingWater) {
      canvas.style.cursor = "crosshair";
    } else if (isEditingBoundary) {
      canvas.style.cursor = "crosshair";
    } else {
      canvas.style.cursor = "";
    }
  }, [isDetectingWater, isEditingBoundary]);

  // ---------------- Boundary Editing Init ----------------
  useEffect(() => {
    if (isEditingBoundary && selectedLake) {
      setEditName(selectedLake.name);
      setEditZone(selectedLake.zone || "South");
      if (selectedLake.boundary && selectedLake.boundary.length >= 3) {
        setEditVertices([...selectedLake.boundary]);
      }
    } else {
      setEditVertices([]);
    }
  }, [isEditingBoundary, selectedLake]);

  // ---------------- Boundary Editing Vertex Markers ----------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    vertexMarkers.current.forEach((m) => m.remove());
    vertexMarkers.current = [];

    const src = map.getSource("custom-boundary-edit-src") as mapboxgl.GeoJSONSource | undefined;

    if (!isEditingBoundary || !editVertices.length) {
      if (src && map.isStyleLoaded()) src.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    editVertices.forEach((pt, index) => {
      const el = document.createElement("div");
      el.className =
        "flex size-4 items-center justify-center rounded-full border-2 border-white bg-cyan-400 font-mono text-[9px] font-bold text-black shadow-xl cursor-move hover:scale-150 transition-transform";
      el.innerText = String(index + 1);

      const marker = new mapboxgl.Marker({ element: el, draggable: true, anchor: "center" })
        .setLngLat(pt)
        .addTo(map);

      marker.on("dragend", () => {
        const lngLat = marker.getLngLat();
        setEditVertices((prev) => {
          const next = [...prev];
          next[index] = [lngLat.lng, lngLat.lat];
          return next;
        });
      });

      vertexMarkers.current.push(marker);
    });

    if (src && map.isStyleLoaded()) {
      if (editVertices.length >= 3) {
        const closed = [...editVertices, editVertices[0]!];
        src.setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Polygon", coordinates: [closed] },
              properties: {},
            },
          ],
        });
      } else if (editVertices.length === 2) {
        src.setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "LineString", coordinates: editVertices },
              properties: {},
            },
          ],
        });
      }
    }
  }, [editVertices, isEditingBoundary]);

  function initBoundaryDrawingSource(map: mapboxgl.Map) {
    if (!map || !map.isStyleLoaded() || map.getSource("custom-boundary-edit-src")) return;
    map.addSource("custom-boundary-edit-src", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "custom-boundary-edit-fill",
      type: "fill",
      source: "custom-boundary-edit-src",
      paint: {
        "fill-color": "#00e5ff",
        "fill-opacity": 0.18,
      },
    });
    map.addLayer({
      id: "custom-boundary-edit-line",
      type: "line",
      source: "custom-boundary-edit-src",
      paint: {
        "line-color": "#00e5ff",
        "line-width": 2.5,
        "line-dasharray": [2, 1],
      },
    });
  }

  // ---------------- Uniform Grid Generation ----------------
  function metersToLngLatOffset(lat: number, meters: number): [number, number] {
    return [meters / (111320 * Math.cos((lat * Math.PI) / 180)), meters / 111320];
  }

  function computeUniformGrids(lake: LakeEntity): GridResult {
    const closed = [...lake.boundary];
    if (closed[0]![0] !== closed[closed.length - 1]![0] || closed[0]![1] !== closed[closed.length - 1]![1]) {
      closed.push(closed[0]!);
    }
    const boundaryPoly = turf.polygon([closed]);

    const bbox = turf.bbox(boundaryPoly as never) as [number, number, number, number];
    const totalAreaM2 = turf.area(boundaryPoly as never);

    const targetCells = 45;
    const cellM = clamp(Math.sqrt(totalAreaM2 / targetCells), 30, 160);
    const [dLng, dLat] = metersToLngLatOffset(lake.lat, cellM);
    const [west, south, east, north] = bbox;

    const rawCells: { poly: GeoJSON.Polygon | GeoJSON.MultiPolygon; cx: number; cy: number; col: number; row: number }[] = [];
    let row = 0;

    for (let y = south; y <= north && rawCells.length < 150; y += dLat, row++) {
      let col = 0;
      for (let x = west; x <= east; x += dLng, col++) {
        const cellCenter = turf.point([x + dLng / 2, y + dLat / 2]);
        const isCenterInside = turf.booleanPointInPolygon(cellCenter, boundaryPoly as never);

        const square = turf.polygon([
          [
            [x, y],
            [x + dLng, y],
            [x + dLng, y + dLat],
            [x, y + dLat],
            [x, y],
          ],
        ]);

        let cellPoly: GeoJSON.Polygon | GeoJSON.MultiPolygon | null = null;

        try {
          const hit = turf.intersect(
            turf.featureCollection([square, boundaryPoly as never]) as never,
          ) as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null;
          if (hit && hit.geometry) {
            const area = turf.area(hit as never);
            if (area > cellM * cellM * 0.08) {
              cellPoly = hit.geometry;
            }
          }
        } catch {
          /* noop */
        }

        if (!cellPoly && isCenterInside) {
          cellPoly = square.geometry;
        }

        if (!cellPoly) continue;

        const c = turf.centroid(cellPoly as never).geometry.coordinates as [number, number];
        rawCells.push({ poly: cellPoly, cx: c[0], cy: c[1], col, row });
      }
    }

    const [sLng, sLat] = lake.startPoint;
    const ranked = rawCells
      .map((c) => ({ ...c, d: (c.cx - sLng) ** 2 + (c.cy - sLat) ** 2 }))
      .sort((a, b) => a.d - b.d);

    const prefix = (lake.name || "LAK").slice(0, 3).toUpperCase();
    const cells: GridSensorData[] = ranked.map((c, rank) => {
      const code = `${prefix}-${String(rank + 1).padStart(2, "0")}`;
      const cellId = `${lake.id}::grid${rank}`;
      return generateCellSensorData(lake, cellId, code, rank, [c.cx, c.cy], c.poly, ranked.length);
    });

    lake.grids = cells;
    return { boundary: boundaryPoly, cells };
  }

  function renderLakeGrids(lake: LakeEntity) {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !lake.boundary || lake.boundary.length < 3) return;

    let result = gridCache.current[lake.id];
    if (!result) {
      result = computeUniformGrids(lake);
      gridCache.current[lake.id] = result;
    }

    activeLakeGrids.current.add(lake.id);

    // 1. Shoreline Boundary Layers
    const bndSrcId = `lake-bnd-src-${lake.id}`;
    const bndFillId = `lake-bnd-fill-${lake.id}`;
    const bndLineId = `lake-bnd-line-${lake.id}`;

    const bndSrc = map.getSource(bndSrcId) as mapboxgl.GeoJSONSource | undefined;
    if (bndSrc) {
      bndSrc.setData(result.boundary as never);
    } else {
      map.addSource(bndSrcId, {
        type: "geojson",
        data: result.boundary as never,
      });
      map.addLayer({
        id: bndFillId,
        type: "fill",
        source: bndSrcId,
        paint: {
          "fill-color": "#00e5ff",
          "fill-opacity": 0.08,
        },
      });
      map.addLayer({
        id: bndLineId,
        type: "line",
        source: bndSrcId,
        paint: {
          "line-color": "#00e5ff",
          "line-width": 2.5,
          "line-opacity": 0.95,
        },
      });
    }

    // 2. Uniform Grid Layers
    const gridSrcId = `lake-grid-src-${lake.id}`;
    const gridFillId = `lake-grid-fill-${lake.id}`;
    const gridLineId = `lake-grid-line-${lake.id}`;

    const geojsonFeatures = result.cells.map((g) => {
      const metric = getGridMetric(g, heatmapModeRef.current);
      return {
        type: "Feature" as const,
        geometry: g.geometry,
        properties: {
          id: g.id,
          code: g.code,
          state: g.state,
          color: metric.color,
          metricLabel: metric.label,
        },
      };
    });

    const gridSrc = map.getSource(gridSrcId) as mapboxgl.GeoJSONSource | undefined;
    if (gridSrc) {
      gridSrc.setData({ type: "FeatureCollection", features: geojsonFeatures } as never);
    } else {
      map.addSource(gridSrcId, {
        type: "geojson",
        data: { type: "FeatureCollection", features: geojsonFeatures } as never,
      });

      map.addLayer({
        id: gridFillId,
        type: "fill",
        source: gridSrcId,
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": ["match", ["get", "state"], "cleaned", 0.38, "active", 0.48, 0.25],
        },
      });

      map.addLayer({
        id: gridLineId,
        type: "line",
        source: gridSrcId,
        paint: {
          "line-color": ["get", "color"],
          "line-width": 1.2,
          "line-opacity": 0.9,
        },
      });

      map.on("mouseenter", gridFillId, () => {
        if (!isEditingRef.current) map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", gridFillId, () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("click", gridFillId, (e) => {
        if (isEditingRef.current) return;
        const f = e.features?.[0];
        if (!f) return;
        const cellId = f.properties?.id;
        const targetGrid = result.cells.find((c) => c.id === cellId);
        if (targetGrid) {
          e.originalEvent.stopPropagation();
          onSelectGrid(targetGrid);
        }
      });
    }
  }

  // Re-render grids when heatmap mode changes
  useEffect(() => {
    if (selectedLake) {
      renderLakeGrids(selectedLake);
    }
  }, [heatmapMode, selectedLake]);

  function cleanupAllGrids() {
    const map = mapRef.current;
    if (!map) return;
    activeLakeGrids.current.forEach((lakeId) => {
      [`lake-grid-fill-${lakeId}`, `lake-grid-line-${lakeId}`, `lake-bnd-fill-${lakeId}`, `lake-bnd-line-${lakeId}`].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getSource(`lake-grid-src-${lakeId}`)) map.removeSource(`lake-grid-src-${lakeId}`);
      if (map.getSource(`lake-bnd-src-${lakeId}`)) map.removeSource(`lake-bnd-src-${lakeId}`);
    });
    activeLakeGrids.current.clear();
  }

  return (
    <div className="relative h-full w-full">
      <div
        ref={container}
        className={`absolute inset-0 h-full w-full ${
          isDetectingWater || isEditingBoundary ? "!cursor-crosshair [&_.maplibregl-canvas]:!cursor-crosshair" : ""
        }`}
      />

      {/* Floating Notice Toast */}
      {detectionNotice && (
        <div className="absolute top-4 left-1/2 z-[850] -translate-x-1/2 rounded-lg border border-amber-500/40 bg-background/95 px-4 py-2 text-xs font-semibold text-amber-500 shadow-xl backdrop-blur-md animate-in fade-in">
          {detectionNotice}
        </div>
      )}

      {/* Floating Toolbar when Boundary Editing is Active with Editable Lake Name & Zone */}
      {isEditingBoundary && selectedLake && (
        <div className="absolute top-4 left-1/2 z-[800] flex -translate-x-1/2 items-center gap-2.5 rounded-xl border border-primary/40 bg-background/95 px-4 py-2 shadow-2xl backdrop-blur-xl animate-in zoom-in-95">
          {/* Editable Name Input */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
              Lake Name:
            </span>
            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="e.g. Hosakerahalli Lake"
              className="w-48 rounded-lg border border-border bg-secondary/80 px-2.5 py-1 text-xs font-bold text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
            />
          </div>

          {/* Editable Zone Select */}
          <select
            value={editZone}
            onChange={(e) => setEditZone(e.target.value)}
            className="rounded-lg border border-border bg-secondary/80 px-2.5 py-1 text-xs text-foreground outline-none focus:border-primary"
          >
            {ZONES.map((z) => (
              <option key={z} value={z}>
                {z} Zone
              </option>
            ))}
          </select>

          <span className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
            ({editVertices.length} vertices)
          </span>

          <div className="h-5 w-px bg-border mx-1" />

          <button
            type="button"
            onClick={() => {
              if (editVertices.length >= 3 && editName.trim()) {
                onSaveCustomBoundary(selectedLake.id, editVertices, editName.trim(), editZone);
                delete gridCache.current[selectedLake.id];
              }
            }}
            disabled={editVertices.length < 3 || !editName.trim()}
            className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-bold text-black shadow-sm hover:bg-emerald-400 disabled:opacity-40 transition-colors"
          >
            Save Lake
          </button>

          <button
            type="button"
            onClick={onCancelEditBoundary}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Floating Heatmap Parameter Selector & Scale Legend HUD */}
      {selectedLake && !isEditingBoundary && (
        <div className="absolute bottom-6 left-4 z-[400] flex flex-col gap-2 rounded-xl border border-border/80 bg-background/95 p-2.5 shadow-2xl backdrop-blur-xl animate-in fade-in">
          <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-1.5 px-0.5">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-primary">
              Grid Heatmap Overlay
            </span>
            <span className="text-[9.5px] font-mono text-muted-foreground">
              {heatmapMode === "status" ? "Survey Progress" : `Heatmap: ${heatmapMode.toUpperCase()}`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: "status", label: "Status" },
              { id: "tds", label: "TDS" },
              { id: "turbidity", label: "Turbidity" },
              { id: "ph", label: "pH" },
              { id: "temp", label: "Temp" },
              { id: "wqi", label: "WQI" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setHeatmapMode(tab.id as HeatmapMode)}
                className={`rounded-md px-2.5 py-1 font-mono text-[10.5px] font-bold transition-all ${
                  heatmapMode === tab.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-border/60 bg-secondary/40 text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Dynamic Heatmap Scale Legend */}
          {heatmapMode !== "status" && (
            <div className="mt-1 border-t border-border/40 pt-1.5 px-0.5">
              <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground mb-1">
                <span>Safe / Low</span>
                <span>Moderate</span>
                <span>Critical Breach</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 via-amber-400 to-red-500" />
              <div className="mt-1 flex items-center justify-between text-[8.5px] font-mono text-muted-foreground">
                {heatmapMode === "tds" && (
                  <>
                    <span>&lt; 250 ppm</span>
                    <span>350 ppm</span>
                    <span>&gt; 500 ppm</span>
                  </>
                )}
                {heatmapMode === "turbidity" && (
                  <>
                    <span>&lt; 8 NTU</span>
                    <span>15 NTU</span>
                    <span>&gt; 25 NTU</span>
                  </>
                )}
                {heatmapMode === "ph" && (
                  <>
                    <span>pH 6.5</span>
                    <span>pH 7.2 (Ideal)</span>
                    <span>&lt;6.2 / &gt;8.6</span>
                  </>
                )}
                {heatmapMode === "temp" && (
                  <>
                    <span>&lt; 24°C</span>
                    <span>28°C</span>
                    <span>&gt; 32°C</span>
                  </>
                )}
                {heatmapMode === "wqi" && (
                  <>
                    <span>80-100 (Clean)</span>
                    <span>60-79</span>
                    <span>&lt; 40 (Severe)</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
