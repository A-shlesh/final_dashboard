/**
 * SCRUB LIVE — Environmental Intelligence & Water Quality Observatory Data Layer.
 * Clean, user-driven data hierarchy:
 * Real Water Body Detection -> Shoreline Boundary -> One-Time Boundary Edit & Lock -> Uniform Grids -> IoT Telemetry.
 */

import * as turf from "@turf/turf";

export type Tier = "healthy" | "stressed" | "critical";
export type NetworkStatus = "Healthy" | "Stressed" | "Critical";
export type Trend = "improving" | "stable" | "declining";
export type CellState = "cleaned" | "active" | "untouched";

export const CELL_COLOR: Record<CellState, string> = {
  cleaned: "#10b981", // Emerald / Cleaned
  active: "#f59e0b",  // Amber / Active
  untouched: "#64748b", // Slate / Untouched
};

export const TIER_COLOR: Record<Tier, string> = {
  healthy: "#10b981",
  stressed: "#f59e0b",
  critical: "#ef4444",
};

export function tierColor(tier: Tier) {
  return TIER_COLOR[tier];
}

export function tierOf(idx: number): Tier {
  return idx >= 70 ? "healthy" : idx >= 40 ? "stressed" : "critical";
}

export type GridSensorData = {
  id: string;          // e.g. "kengeri-lake::cell0"
  code: string;        // e.g. "KEN-01"
  lakeId: string;
  rank: number;
  state: CellState;
  color: string;
  // 8 Hardware IoT Sensors:
  mq135: number;       // Gas quality in ppm (safe: < 50 ppm)
  turbidity: number;   // Water clarity in NTU (safe: < 15 NTU)
  ph: number;          // 0-14 analog probe (safe: 6.5 - 8.5)
  tds: number;         // Total Dissolved Solids in ppm (safe: < 300 ppm)
  dhtTemp: number;     // Water surface temp in °C (safe: 22 - 28 °C)
  dhtHumidity: number; // Relative humidity in %
  gps: [number, number]; // [lat, lng]
  compass: number;     // Heading in degrees 0 - 359°
  networkStatus: NetworkStatus;
  waterHealthIndex: number; // 0 - 100
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
};

export type LakeAggregates = {
  avgMq135: number;
  avgTurbidity: number;
  avgPh: number;
  avgTds: number;
  avgTemp: number;
  avgHumidity: number;
  centroidGps: [number, number];
  circularCompass: number;
  waterHealthIndex: number;
  networkStatus: NetworkStatus;
  totalGrids: number;
  cleanedGrids: number;
  activeGrids: number;
  untouchedGrids: number;
  reclaimedPct: number;
};

export type LakeEntity = {
  id: string;
  name: string;
  zone: string;
  lat: number;
  lng: number;
  areaHa: number;
  coveragePct: number;
  startPoint: [number, number];
  boundaryLocked: boolean; // Once locked, cannot be edited again
  boundary: [number, number][]; // Real [lng, lat][] coordinates of shoreline
  grids?: GridSensorData[];
  lastDeployment: string;
  robotUnit: string;
};

export function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export function strHash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export const ZONES = ["West", "East", "South", "North", "Central"];

/** Sweep progress for a grid cell */
export function cellStateFor(rank: number, total: number, coveragePct: number): CellState {
  if (total <= 0) return "untouched";
  const cleaned = (coveragePct / 100) * total;
  const activeBand = Math.max(1, Math.round(total * 0.06));
  if (rank < cleaned) return "cleaned";
  if (coveragePct > 0 && rank < cleaned + activeBand) return "active";
  return "untouched";
}

/**
 * Generate deterministic 8-sensor IoT readings for a grid cell
 */
export function generateCellSensorData(
  lake: LakeEntity,
  cellId: string,
  code: string,
  rank: number,
  centroid: [number, number], // [lng, lat]
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  totalCells: number,
): GridSensorData {
  const seed = strHash(cellId) + rank * 997 + 13;
  const rnd = seededRandom(seed);

  const baseStress = (strHash(lake.id) % 45) + 20;
  const cellStressOffset = (rnd() - 0.5) * 18;
  const healthIndex = Math.round(clamp(100 - (baseStress + cellStressOffset), 18, 95));

  const ph = +clamp(7.3 + (rnd() - 0.5) * 1.2 - (healthIndex < 40 ? 0.5 : 0), 6.0, 8.8).toFixed(2);
  const turbidity = +clamp(
    Math.round(6 + (100 - healthIndex) * 0.8 + (rnd() - 0.5) * 10),
    3,
    140,
  ).toFixed(1);
  const tds = Math.round(clamp(120 + (100 - healthIndex) * 5.5 + (rnd() - 0.5) * 40, 80, 850));
  const mq135 = Math.round(clamp(20 + (100 - healthIndex) * 0.45 + (rnd() - 0.5) * 8, 12, 90));
  const dhtTemp = +(24.2 + (rnd() - 0.5) * 3.5).toFixed(1);
  const dhtHumidity = Math.round(clamp(58 + (rnd() - 0.5) * 20, 42, 90));
  const compass = Math.round((rank * 37 + (rnd() - 0.5) * 15) % 360);

  const state = cellStateFor(rank, totalCells, lake.coveragePct);

  const networkStatus: NetworkStatus =
    healthIndex >= 65 ? "Healthy" : healthIndex >= 40 ? "Stressed" : "Critical";

  return {
    id: cellId,
    code,
    lakeId: lake.id,
    rank,
    state,
    color: CELL_COLOR[state],
    mq135,
    turbidity: Number(turbidity),
    ph,
    tds,
    dhtTemp,
    dhtHumidity,
    gps: [centroid[1], centroid[0]], // [lat, lng]
    compass,
    networkStatus,
    waterHealthIndex: healthIndex,
    geometry,
  };
}

/**
 * PURE DYNAMIC AGGREGATION:
 * Computes lake-level numeric telemetry directly from its constituent grid cells.
 */
export function computeLakeAggregates(
  grids: GridSensorData[],
  lakeCenter: [number, number],
): LakeAggregates {
  if (!grids || grids.length === 0) {
    return {
      avgMq135: 32,
      avgTurbidity: 10,
      avgPh: 7.2,
      avgTds: 210,
      avgTemp: 24.8,
      avgHumidity: 64,
      centroidGps: lakeCenter,
      circularCompass: 0,
      waterHealthIndex: 72,
      networkStatus: "Healthy",
      totalGrids: 0,
      cleanedGrids: 0,
      activeGrids: 0,
      untouchedGrids: 0,
      reclaimedPct: 0,
    };
  }

  const n = grids.length;
  let sumMq = 0;
  let sumTurb = 0;
  let sumPh = 0;
  let sumTds = 0;
  let sumTemp = 0;
  let sumHum = 0;
  let sumHealth = 0;

  let sumSin = 0;
  let sumCos = 0;

  let cleaned = 0;
  let active = 0;
  let untouched = 0;

  let criticalCount = 0;
  let stressedCount = 0;

  for (const g of grids) {
    sumMq += g.mq135;
    sumTurb += g.turbidity;
    sumPh += g.ph;
    sumTds += g.tds;
    sumTemp += g.dhtTemp;
    sumHum += g.dhtHumidity;
    sumHealth += g.waterHealthIndex;

    const rad = (g.compass * Math.PI) / 180;
    sumSin += Math.sin(rad);
    sumCos += Math.cos(rad);

    if (g.state === "cleaned") cleaned++;
    else if (g.state === "active") active++;
    else untouched++;

    if (g.networkStatus === "Critical") criticalCount++;
    else if (g.networkStatus === "Stressed") stressedCount++;
  }

  let circularCompass = Math.round((Math.atan2(sumSin / n, sumCos / n) * 180) / Math.PI);
  if (circularCompass < 0) circularCompass += 360;

  const avgHealth = Math.round(sumHealth / n);

  let networkStatus: NetworkStatus = "Healthy";
  if (criticalCount > 0) networkStatus = "Critical";
  else if (stressedCount > n * 0.25) networkStatus = "Stressed";

  return {
    avgMq135: Math.round(sumMq / n),
    avgTurbidity: +(sumTurb / n).toFixed(1),
    avgPh: +(sumPh / n).toFixed(2),
    avgTds: Math.round(sumTds / n),
    avgTemp: +(sumTemp / n).toFixed(1),
    avgHumidity: Math.round(sumHum / n),
    centroidGps: lakeCenter,
    circularCompass,
    waterHealthIndex: avgHealth,
    networkStatus,
    totalGrids: n,
    cleanedGrids: cleaned,
    activeGrids: active,
    untouchedGrids: untouched,
    reclaimedPct: Math.round((cleaned / n) * 100),
  };
}

export function nearestLake(lakes: LakeEntity[], lng: number, lat: number): LakeEntity | null {
  if (!lakes || lakes.length === 0) return null;
  let best = lakes[0]!;
  let bestD = Infinity;
  lakes.forEach((l) => {
    const d = (l.lng - lng) ** 2 + (l.lat - lat) ** 2;
    if (d < bestD) {
      bestD = d;
      best = l;
    }
  });
  return best;
}

export type Anomaly = { lakeId: string; msg: string; hoursAgo: number; sev: Tier };

export const ANOMALIES: Anomaly[] = [
  { lakeId: "kengeri-lake", msg: "Sector sweep complete — water quality improved", hoursAgo: 1, sev: "healthy" },
  { lakeId: "ulsoor-lake", msg: "pH drifted alkaline (8.4) in southern sector", hoursAgo: 2, sev: "critical" },
  { lakeId: "bellandur-lake", msg: "TDS spike post overnight runoff", hoursAgo: 5, sev: "critical" },
];

export function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
