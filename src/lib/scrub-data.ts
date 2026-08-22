export type LakeStatus = "cleaned" | "active" | "untouched";

export type Lake = {
  id: string;
  name: string;
  ward: string;
  status: LakeStatus;
  /** percentage coords on the macro map viewport */
  x: number;
  y: number;
  areaHa: number;
  extractedKg: number;
};

export const LAKES: Lake[] = [
  { id: "KEN", name: "Kengeri Lake", ward: "RR Nagar", status: "active", x: 21, y: 63, areaHa: 42.5, extractedKg: 3820 },
  { id: "BEL", name: "Bellandur Lake", ward: "Bellandur", status: "active", x: 74, y: 66, areaHa: 361.0, extractedKg: 11240 },
  { id: "VRT", name: "Varthur Lake", ward: "Varthur", status: "untouched", x: 86, y: 61, areaHa: 220.0, extractedKg: 0 },
  { id: "ULS", name: "Ulsoor Lake", ward: "Halasuru", status: "cleaned", x: 57, y: 43, areaHa: 50.0, extractedKg: 6410 },
  { id: "SNK", name: "Sankey Tank", ward: "Malleswaram", status: "cleaned", x: 44, y: 33, areaHa: 15.0, extractedKg: 2180 },
  { id: "HEB", name: "Hebbal Lake", ward: "Hebbal", status: "active", x: 52, y: 18, areaHa: 75.0, extractedKg: 4990 },
  { id: "MDV", name: "Madivala Lake", ward: "BTM Layout", status: "untouched", x: 60, y: 76, areaHa: 114.0, extractedKg: 0 },
  { id: "JKR", name: "Jakkur Lake", ward: "Jakkur", status: "cleaned", x: 62, y: 10, areaHa: 66.0, extractedKg: 5120 },
  { id: "AGR", name: "Agara Lake", ward: "HSR", status: "untouched", x: 71, y: 74, areaHa: 39.0, extractedKg: 0 },
  { id: "YDR", name: "Yediyur Lake", ward: "Jayanagar", status: "cleaned", x: 45, y: 71, areaHa: 12.0, extractedKg: 1440 },
  { id: "PTR", name: "Puttenahalli Lake", ward: "JP Nagar", status: "active", x: 51, y: 86, areaHa: 13.5, extractedKg: 980 },
  { id: "NGV", name: "Nagavara Lake", ward: "Nagavara", status: "untouched", x: 68, y: 22, areaHa: 40.0, extractedKg: 0 },
];

export const STATUS_META: Record<LakeStatus, { label: string; color: string; token: string }> = {
  cleaned: { label: "RECLAIMED", color: "var(--signal)", token: "text-signal" },
  active: { label: "ACTIVE / TESTING", color: "var(--caution)", token: "text-caution" },
  untouched: { label: "UNSURVEYED", color: "var(--inert)", token: "text-inert" },
};

export const GRID_COLS = 12;
export const GRID_ROWS = 8;

export type Cell = {
  id: string;
  col: number;
  row: number;
  sector: number;
  water: boolean;
  ph: number;
  turbidity: number;
  tds: number;
  humidity: number;
  temp: number;
  dissolvedOxygen: number;
  /** 0-1 predicted algal bloom risk */
  bloomRisk: number;
  debris: number;
  swept: boolean;
};

/** deterministic pseudo-random so SSR and client agree */
function rand(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** organic lake silhouette inside the grid */
function inWater(col: number, row: number, seed: number) {
  const cx = (col + 0.5) / GRID_COLS - 0.5;
  const cy = (row + 0.5) / GRID_ROWS - 0.5;
  const wobble = 0.06 * Math.sin(seed + col * 0.9) + 0.05 * Math.cos(seed * 1.7 + row * 1.3);
  return (cx * cx) / 0.19 + (cy * cy) / 0.15 < 1 + wobble * 3;
}

export function buildGrid(lake: Lake): Cell[] {
  const base = lake.id.charCodeAt(0) + lake.id.charCodeAt(1) * 3 + lake.id.charCodeAt(2) * 7;
  const cells: Cell[] = [];
  let sector = 0;
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const s = base + row * GRID_COLS + col;
      const water = inWater(col, row, base % 10);
      sector += 1;
      const pollution = rand(s) * 0.7 + (col / GRID_COLS) * 0.3;
      cells.push({
        id: `${lake.id}-${String.fromCharCode(65 + row)}${col + 1}`,
        col,
        row,
        sector,
        water,
        ph: +(6.2 + rand(s + 1) * 2.6).toFixed(2),
        turbidity: +(4 + pollution * 96).toFixed(1),
        tds: Math.round(180 + pollution * 1100),
        humidity: +(58 + rand(s + 3) * 34).toFixed(1),
        temp: +(23.5 + rand(s + 4) * 7).toFixed(1),
        dissolvedOxygen: +(1.4 + (1 - pollution) * 7.2).toFixed(2),
        bloomRisk: +Math.min(0.98, pollution * 0.85 + rand(s + 5) * 0.25).toFixed(2),
        debris: Math.round(rand(s + 6) * 140),
        swept: lake.status === "cleaned" ? true : rand(s + 7) > 0.55,
      });
    }
  }
  return cells;
}

export type Metric = {
  key: keyof Pick<Cell, "ph" | "turbidity" | "tds" | "humidity" | "temp" | "dissolvedOxygen">;
  label: string;
  unit: string;
  min: number;
  max: number;
  /** nominal operating band */
  nominal: [number, number];
  decimals: number;
};

export const METRICS: Metric[] = [
  { key: "ph", label: "pH Level", unit: "pH", min: 0, max: 14, nominal: [6.5, 8.5], decimals: 2 },
  { key: "turbidity", label: "Turbidity", unit: "NTU", min: 0, max: 120, nominal: [0, 25], decimals: 1 },
  { key: "tds", label: "Total Dissolved Solids", unit: "ppm", min: 0, max: 1500, nominal: [0, 500], decimals: 0 },
  { key: "humidity", label: "Rel. Humidity", unit: "%", min: 0, max: 100, nominal: [40, 85], decimals: 1 },
  { key: "temp", label: "Surface Temp", unit: "°C", min: 0, max: 45, nominal: [20, 30], decimals: 1 },
  { key: "dissolvedOxygen", label: "Dissolved Oxygen", unit: "mg/L", min: 0, max: 10, nominal: [5, 10], decimals: 2 },
];

export function isNominal(m: Metric, v: number) {
  return v >= m.nominal[0] && v <= m.nominal[1];
}

export type Bot = {
  id: string;
  name: string;
  state: "SWEEPING" | "TRANSIT" | "DOCKED" | "FAULT";
  battery: number;
  voltage: number;
  rpm: number;
  hopper: number;
  lake: string;
};

export const FLEET: Bot[] = [
  { id: "SCRUB-01", name: "SCRUB V2 // ALPHA", state: "SWEEPING", battery: 74, voltage: 24.8, rpm: 2140, hopper: 62, lake: "Kengeri Lake" },
  { id: "SCRUB-02", name: "SCRUB V2 // BRAVO", state: "TRANSIT", battery: 51, voltage: 23.9, rpm: 1680, hopper: 88, lake: "Bellandur Lake" },
  { id: "SCRUB-03", name: "SCRUB V1 // CHARLIE", state: "DOCKED", battery: 97, voltage: 25.4, rpm: 0, hopper: 4, lake: "Hebbal Lake" },
  { id: "SCRUB-04", name: "SCRUB V1 // DELTA", state: "FAULT", battery: 12, voltage: 21.1, rpm: 0, hopper: 71, lake: "Ulsoor Lake" },
];

export type Anomaly = {
  id: string;
  ts: string;
  severity: "CRITICAL" | "WARN" | "INFO";
  grid: string;
  message: string;
};

export const ANOMALIES: Anomaly[] = [
  { id: "AN-4471", ts: "06:41:07Z", severity: "CRITICAL", grid: "KEN-D7", message: "Sudden pH drop 7.4 → 5.1 — probable industrial discharge" },
  { id: "AN-4470", ts: "06:38:52Z", severity: "CRITICAL", grid: "BEL-F3", message: "TDS spike +840 ppm over 90s baseline" },
  { id: "AN-4468", ts: "06:22:14Z", severity: "WARN", grid: "KEN-B4", message: "DO below 3.0 mg/L — hypoxic band forming" },
  { id: "AN-4463", ts: "05:57:30Z", severity: "WARN", grid: "VRT-E9", message: "Turbidity trending +18 NTU/hr" },
  { id: "AN-4459", ts: "05:31:02Z", severity: "INFO", grid: "KEN-A2", message: "Hyacinth mat fragmentation confirmed by vision model" },
  { id: "AN-4455", ts: "04:58:44Z", severity: "INFO", grid: "HEB-C6", message: "Sweep pass 12 completed — 41.2 kg extracted" },
];

export const BIOMASS_SERIES = [
  { t: "W-11", actual: 12, forecast: 12 },
  { t: "W-10", actual: 15, forecast: 14 },
  { t: "W-09", actual: 19, forecast: 18 },
  { t: "W-08", actual: 26, forecast: 25 },
  { t: "W-07", actual: 31, forecast: 33 },
  { t: "W-06", actual: 28, forecast: 30 },
  { t: "W-05", actual: 22, forecast: 24 },
  { t: "W-04", actual: 18, forecast: 19 },
  { t: "W-03", actual: 21, forecast: 22 },
  { t: "W-02", actual: 27, forecast: 29 },
  { t: "W-01", actual: 33, forecast: 36 },
  { t: "NOW", actual: 38, forecast: 41 },
  { t: "W+1", actual: null, forecast: 49 },
  { t: "W+2", actual: null, forecast: 58 },
  { t: "W+3", actual: null, forecast: 64 },
];

export const QUALITY_DELTA = [
  { m: "JAN", ph: 6.1, do: 2.4, ntu: 88 },
  { m: "FEB", ph: 6.3, do: 2.9, ntu: 81 },
  { m: "MAR", ph: 6.6, do: 3.6, ntu: 72 },
  { m: "APR", ph: 6.9, do: 4.4, ntu: 61 },
  { m: "MAY", ph: 7.1, do: 5.1, ntu: 52 },
  { m: "JUN", ph: 7.2, do: 5.8, ntu: 44 },
  { m: "JUL", ph: 7.4, do: 6.3, ntu: 38 },
];

export const EXTRACTION_SERIES = [
  { m: "JAN", kg: 410 },
  { m: "FEB", kg: 520 },
  { m: "MAR", kg: 690 },
  { m: "APR", kg: 880 },
  { m: "MAY", kg: 1020 },
  { m: "JUN", kg: 1210 },
  { m: "JUL", kg: 1385 },
];

export const MODELS = [
  { name: "HYACINTH-FORECAST", ver: "v3.2", acc: 94.1, state: "RUNNING" },
  { name: "ANOMALY-ISOFOREST", ver: "v1.8", acc: 97.6, state: "RUNNING" },
  { name: "BLOOM-LSTM", ver: "v2.0", acc: 89.3, state: "RUNNING" },
  { name: "SWARM-ROUTER-A*", ver: "v0.9", acc: 91.7, state: "TRAINING" },
];
