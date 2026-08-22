/**
 * kengeri-simulation.ts
 * Real-time synthetic telemetry generator for SCRUB Robot on Kengeri Lake, Bengaluru.
 * Hardware sensors modeled:
 * - MQ-135: Gas CO (ppm), Gas CH4 (ppm), Air Quality
 * - Turbidity: Water clarity / light scattering (NTU)
 * - pH: Acidity / alkalinity (0-14 pH)
 * - TDS: Total Dissolved Solids (ppm / mg/L)
 * - DHT (DHT11/DHT22): Ambient Temp (°C), Water Temp (°C), Rel. Humidity (%)
 * - GPS + Compass: Lat/Lon, Heading / Bearing (°), Ground Speed (m/s), Satellites
 */

export type SensorReading = {
  index: number;
  timestamp: string;
  latitude: number;
  longitude: number;
  heading: number; // Compass bearing 0-359°
  speed: number; // m/s
  satellites: number;
  // Sensors:
  ph: number;
  turbidity: number;
  tds: number;
  watertemp: number;
  ambitemp: number;
  humidity: number;
  gasCO: number;
  gasCH4: number;
  // Computed flags:
  hotspot: boolean;
  wqi: number;
};

export type SensorThreshold = {
  low?: number;
  high?: number;
  unit: string;
  label: string;
  sensorHardware: string;
  description: string;
};

export const SENSOR_THRESHOLDS: Record<string, SensorThreshold> = {
  ph: { low: 6.5, high: 8.5, unit: "pH", label: "pH Level", sensorHardware: "Analog pH Probe", description: "CPCB Class C standard (6.5 - 8.5)" },
  turbidity: { high: 25, unit: "NTU", label: "Turbidity", sensorHardware: "Optical Turbidity Sensor", description: "Advisory threshold ≤ 25 NTU" },
  tds: { high: 500, unit: "ppm", label: "TDS", sensorHardware: "Analog TDS Sensor", description: "IS:10500 standard ≤ 500 ppm" },
  watertemp: { high: 35, unit: "°C", label: "Water Temp", sensorHardware: "DHT / DS18B20", description: "Surface water temp nominal ≤ 35°C" },
  ambitemp: { high: 40, unit: "°C", label: "Ambient Temp", sensorHardware: "DHT11/22", description: "Ambient temperature limit ≤ 40°C" },
  humidity: { high: 90, unit: "%", label: "Humidity", sensorHardware: "DHT11/22", description: "Relative humidity threshold ≤ 90%" },
  gasCO: { high: 9, unit: "ppm", label: "Gas CO", sensorHardware: "MQ-135 Gas Sensor", description: "Carbon Monoxide limit ≤ 9 ppm" },
  gasCH4: { high: 1000, unit: "ppm", label: "Gas CH₄", sensorHardware: "MQ-135 Gas Sensor", description: "Methane gas threshold ≤ 1000 ppm" },
};

export const MODERATE_THRESHOLDS: Record<string, { low?: number; high?: number }> = {
  ph: { low: 6.8, high: 8.0 },
  turbidity: { high: 15 },
  tds: { high: 350 },
  watertemp: { high: 30 },
  ambitemp: { high: 36 },
  humidity: { high: 80 },
  gasCO: { high: 6 },
  gasCH4: { high: 700 },
};

export const KENGERI_LAKE_BOUNDARY: [number, number][] = [
  [12.9183159, 77.4906387],
  [12.9185313, 77.4904869],
  [12.9185826, 77.4903919],
  [12.918593, 77.4902793],
  [12.9185251, 77.490172],
  [12.9184268, 77.4899021],
  [12.9184205, 77.4895765],
  [12.918478, 77.4894585],
  [12.9184519, 77.4893137],
  [12.9183787, 77.4892439],
  [12.9182647, 77.489135],
  [12.9181904, 77.4890562],
  [12.9180973, 77.4889258],
  [12.9179447, 77.4888523],
  [12.9178558, 77.4887987],
  [12.9177209, 77.4887166],
  [12.9176634, 77.4886147],
  [12.9176362, 77.488509],
  [12.9176163, 77.4884162],
  [12.9176414, 77.4880423],
  [12.9174898, 77.4876292],
  [12.9174281, 77.4875096],
  [12.9172806, 77.4873825],
  [12.9171395, 77.4872537],
  [12.9171133, 77.4871679],
  [12.9171604, 77.4870284],
  [12.9171447, 77.4869211],
  [12.9171185, 77.4867924],
  [12.9170506, 77.4867441],
  [12.9169408, 77.4866475],
  [12.9158114, 77.486272],
  [12.9148284, 77.4859984],
  [12.9141643, 77.4858],
  [12.9139081, 77.4856551],
  [12.9138192, 77.4855907],
  [12.9137094, 77.4855425],
  [12.9135954, 77.4855462],
  [12.9135432, 77.4856481],
  [12.9135578, 77.4857678],
  [12.913699, 77.4859609],
  [12.9142584, 77.4864008],
  [12.9147447, 77.486846],
  [12.9153251, 77.4873664],
  [12.915597, 77.4876346],
  [12.9158114, 77.4878974],
  [12.9160425, 77.4883894],
  [12.9162982, 77.4888008],
  [12.9167682, 77.4896248],
  [12.9169721, 77.489834],
  [12.9174793, 77.4903383],
  [12.9179342, 77.4906762],
  [12.9181172, 77.4907352],
  [12.9182072, 77.4907068],
  [12.9183159, 77.4906387],
];

export const HOTSPOT_ZONES = [
  { lat: 12.9165, lon: 77.4885, radius: 0.00025, severity: 0.8, label: "Sewage Inflow Zone" },
  { lat: 12.9178, lon: 77.4898, radius: 0.00025, severity: 0.7, label: "Industrial Runoff Point" },
  { lat: 12.9145, lon: 77.4863, radius: 0.0002, severity: 0.5, label: "Solid Waste / Silt Bank" },
];

function isPointInPolygon(lat: number, lon: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]![1];
    const yi = poly[i]![0];
    const xj = poly[j]![1];
    const yj = poly[j]![0];

    const intersect = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function gaussianRandom(mean = 0, stdev = 1) {
  const u1 = 1 - Math.random();
  const u2 = 1 - Math.random();
  const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
  return mean + stdev * randStdNormal;
}

function calculateWqiRow(row: {
  ph: number;
  turbidity: number;
  tds: number;
  watertemp: number;
  gasCO: number;
  gasCH4: number;
}) {
  const standards: Record<string, { ideal: number; standard: number }> = {
    ph: { ideal: 7.0, standard: 8.5 },
    turbidity: { ideal: 0.0, standard: 5.0 },
    tds: { ideal: 0.0, standard: 500.0 },
    watertemp: { ideal: 25.0, standard: 35.0 },
    gasCO: { ideal: 0.0, standard: 9.0 },
    gasCH4: { ideal: 0.0, standard: 1000.0 },
  };

  let sumW = 0;
  let sumWQ = 0;

  for (const [key, std] of Object.entries(standards)) {
    const actual = (row as any)[key] ?? std.ideal;
    const denom = std.standard - std.ideal;
    if (Math.abs(denom) < 1e-9) continue;
    let qn = ((actual - std.ideal) / denom) * 100;
    qn = Math.max(0, Math.min(qn, 300));
    const wn = 1.0 / std.standard;
    sumW += wn;
    sumWQ += wn * qn;
  }

  if (sumW === 0) return 100;
  const wqi = sumWQ / sumW;
  return Math.max(0, Math.min(100, Math.round((100 - wqi) * 10) / 10));
}

export function generateKengeriGridPath(step = 0.000085): [number, number][] {
  const lats = KENGERI_LAKE_BOUNDARY.map((p) => p[0]);
  const lons = KENGERI_LAKE_BOUNDARY.map((p) => p[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const points: [number, number][] = [];
  let curLat = minLat;
  let leftToRight = true;

  while (curLat <= maxLat) {
    if (leftToRight) {
      let curLon = minLon;
      while (curLon <= maxLon) {
        if (isPointInPolygon(curLat, curLon, KENGERI_LAKE_BOUNDARY)) {
          points.push([curLat, curLon]);
        }
        curLon += step;
      }
    } else {
      let curLon = maxLon;
      while (curLon >= minLon) {
        if (isPointInPolygon(curLat, curLon, KENGERI_LAKE_BOUNDARY)) {
          points.push([curLat, curLon]);
        }
        curLon -= step;
      }
    }
    leftToRight = !leftToRight;
    curLat += step;
  }

  return points;
}

export function generateKengeriDataset(): SensorReading[] {
  const grid = generateKengeriGridPath();
  const total = grid.length;
  const records: SensorReading[] = [];
  const startTime = new Date("2026-08-18T06:00:00Z");

  for (let i = 0; i < total; i++) {
    const pt = grid[i]!;
    const lat = pt[0];
    const lon = pt[1];

    // Compute compass bearing to next point
    let heading = 90;
    if (i < total - 1) {
      const nextPt = grid[i + 1]!;
      const dLon = ((nextPt[1] - lon) * Math.PI) / 180;
      const lat1 = (lat * Math.PI) / 180;
      const lat2 = (nextPt[0] * Math.PI) / 180;
      const y = Math.sin(dLon) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
      heading = Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
    }

    // Hotspot influence
    let maxInfluence = 0;
    for (const hz of HOTSPOT_ZONES) {
      const dist = Math.sqrt((lat - hz.lat) ** 2 + (lon - hz.lon) ** 2);
      if (dist < hz.radius * 2.5) {
        const inf = hz.severity * Math.exp(-0.5 * (dist / hz.radius) ** 2);
        maxInfluence = Math.max(maxInfluence, inf);
      }
    }

    const progress = i / Math.max(total - 1, 1);

    // Base clean water values
    const basePh = 7.2;
    const baseTurb = 3.2;
    const baseTds = 260.0;
    const baseWaterTemp = 24.8;
    const baseAmbiTemp = 28.5;
    const baseHumid = 64.0;
    const baseGasCO = 3.2;
    const baseGasCH4 = 380.0;

    // Temporal drift
    const driftPh = -0.12 * progress;
    const driftTurb = 1.8 * progress;
    const driftTds = 35.0 * progress;
    const driftWaterTemp = 1.6 * Math.sin(progress * Math.PI);
    const driftAmbiTemp = 2.4 * Math.sin(progress * Math.PI);
    const driftHumid = 4.5 * progress;
    const driftGasCO = 0.8 * progress;
    const driftGasCH4 = 70.0 * progress;

    // Hotspot overlay
    const pollPh = -1.9 * maxInfluence;
    const pollTurb = 32.0 * maxInfluence;
    const pollTds = 420.0 * maxInfluence;
    const pollWaterTemp = 7.2 * maxInfluence;
    const pollAmbiTemp = 4.8 * maxInfluence;
    const pollHumid = 16.0 * maxInfluence;
    const pollGasCO = 16.5 * maxInfluence;
    const pollGasCH4 = 1600.0 * maxInfluence;

    // Normal sensor noise
    const noisePh = gaussianRandom(0, 0.12);
    const noiseTurb = gaussianRandom(0, 1.2);
    const noiseTds = gaussianRandom(0, 18);
    const noiseWaterTemp = gaussianRandom(0, 0.6);
    const noiseAmbiTemp = gaussianRandom(0, 0.9);
    const noiseHumid = gaussianRandom(0, 2.2);
    const noiseGasCO = gaussianRandom(0, 0.6);
    const noiseGasCH4 = gaussianRandom(0, 40);

    // Occasional spikes (~1.5% chance)
    let spikePh = 0;
    let spikeTurb = 0;
    let spikeTds = 0;
    let spikeWaterTemp = 0;
    let spikeGasCO = 0;
    let spikeGasCH4 = 0;

    if (Math.random() < 0.018) {
      const pick = Math.floor(Math.random() * 6);
      if (pick === 0) spikePh = (Math.random() > 0.5 ? 1 : -1) * (1.0 + Math.random() * 0.4);
      if (pick === 1) spikeTurb = 16 + Math.random() * 14;
      if (pick === 2) spikeTds = 180 + Math.random() * 160;
      if (pick === 3) spikeWaterTemp = 4.5 + Math.random() * 3;
      if (pick === 4) spikeGasCO = 6 + Math.random() * 8;
      if (pick === 5) spikeGasCH4 = 400 + Math.random() * 500;
    }

    const ph = +Math.max(3.2, Math.min(10.8, basePh + driftPh + pollPh + noisePh + spikePh)).toFixed(2);
    const turbidity = +Math.max(0.5, Math.min(80, baseTurb + driftTurb + pollTurb + noiseTurb + spikeTurb)).toFixed(1);
    const tds = +Math.max(60, Math.min(1400, baseTds + driftTds + pollTds + noiseTds + spikeTds)).toFixed(0);
    const watertemp = +Math.max(16, Math.min(42, baseWaterTemp + driftWaterTemp + pollWaterTemp + noiseWaterTemp + spikeWaterTemp)).toFixed(1);
    const ambitemp = +Math.max(18, Math.min(46, baseAmbiTemp + driftAmbiTemp + pollAmbiTemp + noiseAmbiTemp)).toFixed(1);
    const humidity = +Math.max(35, Math.min(98, baseHumid + driftHumid + pollHumid + noiseHumid)).toFixed(1);
    const gasCO = +Math.max(0.4, Math.min(50, baseGasCO + driftGasCO + pollGasCO + noiseGasCO + spikeGasCO)).toFixed(1);
    const gasCH4 = +Math.max(80, Math.min(7500, baseGasCH4 + driftGasCH4 + pollGasCH4 + noiseGasCH4 + spikeGasCH4)).toFixed(0);

    const isHotspot =
      ph < 6.2 ||
      ph > 8.8 ||
      turbidity > 25 ||
      tds > 500 ||
      watertemp > 35 ||
      gasCO > 9 ||
      gasCH4 > 1000;

    const wqi = calculateWqiRow({ ph, turbidity, tds, watertemp, gasCO, gasCH4 });

    const time = new Date(startTime.getTime() + i * 5000);

    records.push({
      index: i + 1,
      timestamp: time.toISOString(),
      latitude: lat,
      longitude: lon,
      heading,
      speed: +(0.8 + Math.random() * 0.4).toFixed(2), // 0.8 - 1.2 m/s
      satellites: Math.floor(10 + Math.random() * 5),
      ph,
      turbidity,
      tds,
      watertemp,
      ambitemp,
      humidity,
      gasCO,
      gasCH4,
      hotspot: isHotspot,
      wqi,
    });
  }

  return records;
}

export function getSensorStatus(sensor: string, val: number): "normal" | "moderate" | "critical" {
  const thresh = SENSOR_THRESHOLDS[sensor];
  const mod = MODERATE_THRESHOLDS[sensor];
  if (!thresh) return "normal";

  if (thresh.low !== undefined && val < thresh.low) return "critical";
  if (thresh.high !== undefined && val > thresh.high) return "critical";

  if (mod) {
    if (mod.low !== undefined && val < mod.low) return "moderate";
    if (mod.high !== undefined && val > mod.high) return "moderate";
  }

  return "normal";
}

export function getTrendSymbol(current: number, prev?: number): { sym: "↑" | "↓" | "→"; color: string } {
  if (prev === undefined) return { sym: "→", color: "var(--signal)" };
  const diff = current - prev;
  const pct = Math.abs(diff) / (Math.abs(prev) + 1e-9);
  if (pct < 0.015) return { sym: "→", color: "var(--signal)" };
  if (diff > 0) return { sym: "↑", color: "var(--caution)" };
  return { sym: "↓", color: "var(--signal)" };
}
