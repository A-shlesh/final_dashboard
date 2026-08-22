/**
 * water-analytics.ts
 * Core analytical algorithms for SCRUB:
 * 1. Water Quality Index (IS:10500 / WHO Weighted Arithmetic Index)
 * 2. Anomaly Detection (multi-threshold breach tracking)
 * 3. Pollution Source Triangulation (Inverse-WQI weighted centroid & dispersion radius)
 * 4. Sensor Correlation Matrix (8x8 Pearson r(X, Y))
 * 5. Spatial Lake Coverage (22m x 22m cell grid)
 * 6. Time-Series Analysis (Linear regression slope, rolling window, local z-score spike detection)
 * 7. Remediation Effectiveness (5-phase mission timeline comparison)
 */

import {
  type SensorReading,
  SENSOR_THRESHOLDS,
  KENGERI_LAKE_BOUNDARY,
} from "./kengeri-simulation";

export const WQI_STANDARDS = {
  ph: { ideal: 7.0, standard: 8.5, weight: 1 / 8.5 },
  turbidity: { ideal: 0.0, standard: 5.0, weight: 1 / 5.0 },
  tds: { ideal: 0.0, standard: 500.0, weight: 1 / 500.0 },
  watertemp: { ideal: 25.0, standard: 35.0, weight: 1 / 35.0 },
  gasCO: { ideal: 0.0, standard: 9.0, weight: 1 / 9.0 },
  gasCH4: { ideal: 0.0, standard: 1000.0, weight: 1 / 1000.0 },
};

export type WqiCategory = "Excellent" | "Good" | "Medium" | "Poor" | "Very Poor";

export function getWqiCategory(score: number): { label: WqiCategory; color: string; bg: string } {
  if (score >= 91) return { label: "Excellent", color: "#34d399", bg: "rgba(52, 211, 153, 0.15)" };
  if (score >= 76) return { label: "Good", color: "#60a5fa", bg: "rgba(96, 165, 250, 0.15)" };
  if (score >= 51) return { label: "Medium", color: "#f5b942", bg: "rgba(245, 185, 66, 0.15)" };
  if (score >= 26) return { label: "Poor", color: "#fb923c", bg: "rgba(251, 146, 60, 0.15)" };
  return { label: "Very Poor", color: "#f87171", bg: "rgba(248, 113, 113, 0.15)" };
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * 1. Compute lake-wide overall WQI based on robust median sensor values.
 */
export function computeOverallWqi(readings: SensorReading[]): number {
  if (!readings.length) return 100;

  const phMedian = median(readings.map((r) => r.ph));
  const turbMedian = median(readings.map((r) => r.turbidity));
  const tdsMedian = median(readings.map((r) => r.tds));
  const tempMedian = median(readings.map((r) => r.watertemp));
  const coMedian = median(readings.map((r) => r.gasCO));
  const ch4Median = median(readings.map((r) => r.gasCH4));

  const medians: Record<string, number> = {
    ph: phMedian,
    turbidity: turbMedian,
    tds: tdsMedian,
    watertemp: tempMedian,
    gasCO: coMedian,
    gasCH4: ch4Median,
  };

  let sumW = 0;
  let sumWQ = 0;

  for (const [key, std] of Object.entries(WQI_STANDARDS)) {
    const actual = medians[key] ?? std.ideal;
    const denom = std.standard - std.ideal;
    if (Math.abs(denom) < 1e-9) continue;
    let qn = ((actual - std.ideal) / denom) * 100;
    qn = Math.max(0, Math.min(qn, 100)); // cap for robust overall
    sumW += std.weight;
    sumWQ += std.weight * qn;
  }

  if (sumW === 0) return 100;
  const wqi = sumWQ / sumW;
  return Math.max(0, Math.min(100, Math.round((100 - wqi) * 10) / 10));
}

/**
 * Running cumulative WQI series as survey progresses
 */
export function computeRunningWqiSeries(readings: SensorReading[], step = 10): { index: number; wqi: number }[] {
  const result: { index: number; wqi: number }[] = [];
  for (let i = step; i <= readings.length; i += step) {
    const chunk = readings.slice(0, i);
    result.push({
      index: i,
      wqi: computeOverallWqi(chunk),
    });
  }
  if (readings.length > 0 && (readings.length % step !== 0 || result.length === 0)) {
    result.push({
      index: readings.length,
      wqi: computeOverallWqi(readings),
    });
  }
  return result;
}

/**
 * 2. Anomaly Alert Item
 */
export type AnomalyAlert = {
  id: string;
  readingIndex: number;
  timestamp: string;
  sensorKey: string;
  sensorLabel: string;
  value: number;
  threshold: number;
  direction: "above" | "below";
  unit: string;
  severity: "CRITICAL" | "WARNING";
  latitude: number;
  longitude: number;
};

export function detectAnomalies(readings: SensorReading[]): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];

  readings.forEach((r) => {
    // Check pH
    if (r.ph < 6.5) {
      alerts.push({
        id: `AL-${r.index}-ph`,
        readingIndex: r.index,
        timestamp: r.timestamp,
        sensorKey: "ph",
        sensorLabel: "pH Level",
        value: r.ph,
        threshold: 6.5,
        direction: "below",
        unit: "pH",
        severity: r.ph < 6.0 ? "CRITICAL" : "WARNING",
        latitude: r.latitude,
        longitude: r.longitude,
      });
    } else if (r.ph > 8.5) {
      alerts.push({
        id: `AL-${r.index}-ph`,
        readingIndex: r.index,
        timestamp: r.timestamp,
        sensorKey: "ph",
        sensorLabel: "pH Level",
        value: r.ph,
        threshold: 8.5,
        direction: "above",
        unit: "pH",
        severity: r.ph > 9.0 ? "CRITICAL" : "WARNING",
        latitude: r.latitude,
        longitude: r.longitude,
      });
    }

    // Turbidity
    if (r.turbidity > 25) {
      alerts.push({
        id: `AL-${r.index}-turb`,
        readingIndex: r.index,
        timestamp: r.timestamp,
        sensorKey: "turbidity",
        sensorLabel: "Turbidity",
        value: r.turbidity,
        threshold: 25,
        direction: "above",
        unit: "NTU",
        severity: r.turbidity > 40 ? "CRITICAL" : "WARNING",
        latitude: r.latitude,
        longitude: r.longitude,
      });
    }

    // TDS
    if (r.tds > 500) {
      alerts.push({
        id: `AL-${r.index}-tds`,
        readingIndex: r.index,
        timestamp: r.timestamp,
        sensorKey: "tds",
        sensorLabel: "TDS",
        value: r.tds,
        threshold: 500,
        direction: "above",
        unit: "ppm",
        severity: r.tds > 750 ? "CRITICAL" : "WARNING",
        latitude: r.latitude,
        longitude: r.longitude,
      });
    }

    // Water Temp
    if (r.watertemp > 35) {
      alerts.push({
        id: `AL-${r.index}-wtemp`,
        readingIndex: r.index,
        timestamp: r.timestamp,
        sensorKey: "watertemp",
        sensorLabel: "Water Temp",
        value: r.watertemp,
        threshold: 35,
        direction: "above",
        unit: "°C",
        severity: r.watertemp > 38 ? "CRITICAL" : "WARNING",
        latitude: r.latitude,
        longitude: r.longitude,
      });
    }

    // Gas CO
    if (r.gasCO > 9) {
      alerts.push({
        id: `AL-${r.index}-co`,
        readingIndex: r.index,
        timestamp: r.timestamp,
        sensorKey: "gasCO",
        sensorLabel: "Gas CO",
        value: r.gasCO,
        threshold: 9,
        direction: "above",
        unit: "ppm",
        severity: r.gasCO > 18 ? "CRITICAL" : "WARNING",
        latitude: r.latitude,
        longitude: r.longitude,
      });
    }

    // Gas CH4
    if (r.gasCH4 > 1000) {
      alerts.push({
        id: `AL-${r.index}-ch4`,
        readingIndex: r.index,
        timestamp: r.timestamp,
        sensorKey: "gasCH4",
        sensorLabel: "Gas CH₄",
        value: r.gasCH4,
        threshold: 1000,
        direction: "above",
        unit: "ppm",
        severity: r.gasCH4 > 2500 ? "CRITICAL" : "WARNING",
        latitude: r.latitude,
        longitude: r.longitude,
      });
    }
  });

  return alerts;
}

/**
 * 3. Pollution Source Triangulation (Weighted Inverse-WQI centroid of hotspots)
 */
export type PollutionCentroid = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  hotspotCount: number;
  severityScore: number;
};

export function triangulatePollutionSource(readings: SensorReading[]): PollutionCentroid | null {
  const hotspots = readings.filter((r) => r.hotspot);
  if (!hotspots.length) return null;

  let totalWeight = 0;
  let weightedLat = 0;
  let weightedLon = 0;

  hotspots.forEach((h) => {
    // Lower WQI -> higher weight
    const weight = 1 / (Math.max(1, h.wqi) + 1e-4);
    totalWeight += weight;
    weightedLat += h.latitude * weight;
    weightedLon += h.longitude * weight;
  });

  const centerLat = weightedLat / totalWeight;
  const centerLon = weightedLon / totalWeight;

  // Compute average dispersion radius in meters (1 deg lat ~ 111,000 m)
  let totalDistMeters = 0;
  hotspots.forEach((h) => {
    const dLat = (h.latitude - centerLat) * 111000;
    const dLon = (h.longitude - centerLon) * 111000 * Math.cos((centerLat * Math.PI) / 180);
    totalDistMeters += Math.sqrt(dLat * dLat + dLon * dLon);
  });

  const avgRadius = Math.max(25, totalDistMeters / hotspots.length);

  return {
    latitude: centerLat,
    longitude: centerLon,
    radiusMeters: Math.round(avgRadius),
    hotspotCount: hotspots.length,
    severityScore: Math.round((hotspots.length / readings.length) * 100),
  };
}

/**
 * 4. Pearson Correlation Matrix (8x8)
 */
export const SENSOR_KEYS = [
  "ph",
  "turbidity",
  "tds",
  "watertemp",
  "ambitemp",
  "humidity",
  "gasCO",
  "gasCH4",
] as const;

export const SENSOR_DISPLAY_NAMES: Record<string, string> = {
  ph: "pH",
  turbidity: "Turbidity",
  tds: "TDS",
  watertemp: "Water Temp",
  ambitemp: "Ambi Temp",
  humidity: "Humidity",
  gasCO: "Gas CO",
  gasCH4: "Gas CH₄",
};

export function computePearsonCorrelationMatrix(readings: SensorReading[]): {
  keys: string[];
  labels: string[];
  matrix: number[][];
} {
  const n = readings.length;
  const keys = [...SENSOR_KEYS];
  const labels = keys.map((k) => SENSOR_DISPLAY_NAMES[k]!);

  if (n < 2) {
    const eye = keys.map((_, i) => keys.map((_, j) => (i === j ? 1 : 0)));
    return { keys, labels, matrix: eye };
  }

  // Pre-calculate means and std devs
  const series: Record<string, number[]> = {};
  const means: Record<string, number> = {};
  const stds: Record<string, number> = {};

  keys.forEach((k) => {
    const vals = readings.map((r) => (r as any)[k] as number);
    series[k] = vals;
    const mean = vals.reduce((a, b) => a + b, 0) / n;
    means[k] = mean;
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
    stds[k] = Math.sqrt(variance);
  });

  const matrix: number[][] = [];

  for (let i = 0; i < keys.length; i++) {
    const row: number[] = [];
    const k1 = keys[i]!;
    for (let j = 0; j < keys.length; j++) {
      if (i === j) {
        row.push(1.0);
        continue;
      }
      const k2 = keys[j]!;
      const s1 = series[k1]!;
      const s2 = series[k2]!;
      const m1 = means[k1]!;
      const m2 = means[k2]!;
      const std1 = stds[k1]!;
      const std2 = stds[k2]!;

      if (std1 < 1e-9 || std2 < 1e-9) {
        row.push(0);
        continue;
      }

      let cov = 0;
      for (let idx = 0; idx < n; idx++) {
        cov += (s1[idx]! - m1) * (s2[idx]! - m2);
      }
      const r = cov / ((n - 1) * std1 * std2);
      row.push(+Math.max(-1, Math.min(1, r)).toFixed(2));
    }
    matrix.push(row);
  }

  return { keys, labels, matrix };
}

/**
 * 5. Spatial Lake Coverage (22m x 22m cells)
 */
export type SpatialCoverage = {
  coveragePct: number;
  visitedCells: number;
  totalCells: number;
  gridCells: { id: string; lat: number; lon: number; count: number; maxTurbidity: number }[];
};

export function computeSpatialCoverage(readings: SensorReading[], gridSizeDeg = 0.0002): SpatialCoverage {
  const lats = KENGERI_LAKE_BOUNDARY.map((p) => p[0]);
  const lons = KENGERI_LAKE_BOUNDARY.map((p) => p[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const nLatCells = Math.ceil((maxLat - minLat) / gridSizeDeg);
  const nLonCells = Math.ceil((maxLon - minLon) / gridSizeDeg);
  const totalCells = Math.max(1, nLatCells * nLonCells);

  const cellMap: Record<string, { count: number; maxTurb: number; lat: number; lon: number }> = {};

  readings.forEach((r) => {
    const cLat = Math.floor((r.latitude - minLat) / gridSizeDeg);
    const cLon = Math.floor((r.longitude - minLon) / gridSizeDeg);
    const id = `${cLat}_${cLon}`;

    if (!cellMap[id]) {
      cellMap[id] = {
        count: 0,
        maxTurb: 0,
        lat: minLat + (cLat + 0.5) * gridSizeDeg,
        lon: minLon + (cLon + 0.5) * gridSizeDeg,
      };
    }
    cellMap[id]!.count += 1;
    cellMap[id]!.maxTurb = Math.max(cellMap[id]!.maxTurb, r.turbidity);
  });

  const visitedCount = Object.keys(cellMap).length;
  const coveragePct = Math.min(100, +((visitedCount / totalCells) * 100).toFixed(1));

  const gridCells = Object.entries(cellMap).map(([id, c]) => ({
    id,
    lat: c.lat,
    lon: c.lon,
    count: c.count,
    maxTurbidity: c.maxTurb,
  }));

  return {
    coveragePct,
    visitedCells: visitedCount,
    totalCells,
    gridCells,
  };
}

/**
 * 6. Time-Series Trend & Spike Analysis
 */
export type TimeSeriesAnalysis = {
  trendLabel: "Rising ↑" | "Falling ↓" | "Stable →";
  slope: number;
  spikeIndices: number[];
  spikeCount: number;
  rollingMean: number[];
  min: number;
  max: number;
  avg: number;
};

export function analyzeSensorTimeSeries(readings: SensorReading[], sensorKey: keyof SensorReading, window = 10): TimeSeriesAnalysis {
  const vals = readings.map((r) => r[sensorKey] as number);
  const n = vals.length;

  if (n === 0) {
    return { trendLabel: "Stable →", slope: 0, spikeIndices: [], spikeCount: 0, rollingMean: [], min: 0, max: 0, avg: 0 };
  }

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const avg = +(vals.reduce((a, b) => a + b, 0) / n).toFixed(2);

  // Linear regression slope
  let slope = 0;
  if (n > 1) {
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += vals[i]!;
      sumXY += i * vals[i]!;
      sumX2 += i * i;
    }
    const denom = n * sumX2 - sumX * sumX;
    slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  }

  let trendLabel: "Rising ↑" | "Falling ↓" | "Stable →" = "Stable →";
  if (slope > 0.015) trendLabel = "Rising ↑";
  else if (slope < -0.015) trendLabel = "Falling ↓";

  // Rolling mean & local z-score spike detection
  const rollingMean: number[] = [];
  const spikeIndices: number[] = [];
  const thresh = SENSOR_THRESHOLDS[sensorKey as string];

  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - window + 1);
    const win = vals.slice(start, i + 1);
    const wMean = win.reduce((a, b) => a + b, 0) / win.length;
    rollingMean.push(+wMean.toFixed(2));

    const variance = win.reduce((a, b) => a + (b - wMean) ** 2, 0) / win.length;
    const std = Math.sqrt(variance);

    const val = vals[i]!;
    const zScore = std > 1e-4 ? Math.abs(val - wMean) / std : 0;

    let isBreach = false;
    if (thresh?.high !== undefined && val > thresh.high) isBreach = true;
    if (thresh?.low !== undefined && val < thresh.low) isBreach = true;

    if (zScore > 1.6 || isBreach) {
      spikeIndices.push(i);
    }
  }

  return {
    trendLabel,
    slope: +slope.toFixed(5),
    spikeIndices,
    spikeCount: spikeIndices.length,
    rollingMean,
    min,
    max,
    avg,
  };
}

/**
 * 7. Remediation Effectiveness (5-Phase Progression)
 */
export type RemediationPhase = {
  phase: number;
  label: string;
  readingsCount: number;
  avgWqi: number;
  minWqi: number;
  maxWqi: number;
  hotspotsFound: number;
  timeRange: string;
};

export type RemediationResult = {
  phases: RemediationPhase[];
  improvementPct: number;
  hotspotReductionPct: number;
  initialWqi: number;
  finalWqi: number;
};

export function computeRemediationEffectiveness(readings: SensorReading[], nPhases = 5): RemediationResult {
  const n = readings.length;
  if (n < 2) {
    return {
      phases: [],
      improvementPct: 0,
      hotspotReductionPct: 0,
      initialWqi: 0,
      finalWqi: 0,
    };
  }

  const phaseSize = Math.max(1, Math.floor(n / nPhases));
  const phases: RemediationPhase[] = [];

  for (let i = 0; i < nPhases; i++) {
    const start = i * phaseSize;
    const end = i === nPhases - 1 ? n : Math.min(start + phaseSize, n);
    if (start >= n) break;

    const chunk = readings.slice(start, end);
    const wqis = chunk.map((c) => c.wqi);
    const avgWqi = +(wqis.reduce((a, b) => a + b, 0) / wqis.length).toFixed(1);
    const minWqi = Math.min(...wqis);
    const maxWqi = Math.max(...wqis);
    const hotspots = chunk.filter((c) => c.hotspot).length;

    const tStart = chunk[0]?.timestamp ? new Date(chunk[0].timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--";
    const tEnd = chunk[chunk.length - 1]?.timestamp ? new Date(chunk[chunk.length - 1]!.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--";

    phases.push({
      phase: i + 1,
      label: `Phase ${i + 1}`,
      readingsCount: chunk.length,
      avgWqi,
      minWqi,
      maxWqi,
      hotspotsFound: hotspots,
      timeRange: `${tStart} – ${tEnd}`,
    });
  }

  const initialWqi = phases[0]?.avgWqi ?? 0;
  const finalWqi = phases[phases.length - 1]?.avgWqi ?? 0;
  const improvementPct = initialWqi > 0 ? +(((finalWqi - initialWqi) / initialWqi) * 100).toFixed(1) : 0;

  const initHotspots = phases[0]?.hotspotsFound ?? 1;
  const finalHotspots = phases[phases.length - 1]?.hotspotsFound ?? 0;
  const hotspotReductionPct = initHotspots > 0 ? +(((initHotspots - finalHotspots) / initHotspots) * 100).toFixed(1) : 0;

  return {
    phases,
    improvementPct,
    hotspotReductionPct,
    initialWqi,
    finalWqi,
  };
}
