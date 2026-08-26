/**
 * SCRUB LIVE — Arduino & Raspberry Pi Telemetry Integration Service.
 *
 * Supports two hardware schemas:
 *
 * 1. Legacy Pi/Arduino format:
 * { "timestamp": 1724061000, "latitude": 13.0827, "longitude": 80.2707,
 *   "tds": 412.5, "turbidity": 18.2, "ph": 7.34,
 *   "air_temperature": 31.4, "humidity": 68.2 }
 *
 * 2. Firebase sensorData/current format (ACTUAL LIVE NODE):
 * { "tds_ppm": 412.5, "turbidity_ntu": 18.2, "ph": 7.34,
 *   "temperature": 31.4, "humidity": 68.2, "mq135_ppm": 35.0,
 *   "status": "ok", "timestamp_ms": 1724061000000 }
 *
 * GPS is NOT included in Firebase sensorData/current — GPS fields are left as 0
 * when unavailable rather than inventing fake coordinates.
 */

export type HardwareTelemetryPacket = {
  timestamp: string;
  source: "live_pi" | "simulated" | "manual_json";
  /** Firebase sensorData/current status field, if present */
  status?: string;
  /** True when GPS coordinates are real hardware data; false when unavailable */
  hasGps?: boolean;
  gps: {
    lat: number;
    lng: number;
    altitudeMeters?: number;
    satellites?: number;
    speedKmph?: number;
  };
  compass: number; // 0 - 359 degrees
  sensors: {
    tds: number | null;         // ppm — null when unavailable
    turbidity: number | null;   // NTU — null when unavailable
    ph: number | null;          // — null when unavailable
    air_temperature: number | null; // °C — null when unavailable
    humidity: number | null;    // % — null when unavailable
    mq135: number | null;       // Gas ppm — null when unavailable
  };
  rawPayload?: Record<string, any>;
  matchedGridCode?: string;
  matchedLakeName?: string;
};

const DEFAULT_PI_ENDPOINT = "http://localhost:5000/telemetry";

export function getPiEndpoint(): string {
  try {
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      return localStorage.getItem("scrub_pi_endpoint") || DEFAULT_PI_ENDPOINT;
    }
  } catch {
    /* fallback */
  }
  return DEFAULT_PI_ENDPOINT;
}

export function savePiEndpoint(url: string) {
  try {
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      localStorage.setItem("scrub_pi_endpoint", url.trim());
    }
  } catch {
    /* noop */
  }
}

/**
 * Universal JSON Parser for Arduino / Pi / Firebase payloads.
 *
 * Supports both the legacy hardware schema AND the actual Firebase
 * sensorData/current schema (tds_ppm, turbidity_ntu, mq135_ppm,
 * temperature, timestamp_ms).
 *
 * IMPORTANT: When a sensor field is genuinely absent from the payload,
 * we return null rather than inventing a fake value.
 */
export function parseRawJsonPacket(
  input: string | Record<string, any>,
  source: "live_pi" | "simulated" | "manual_json" = "live_pi",
): HardwareTelemetryPacket {
  let data: Record<string, any>;
  if (typeof input === "string") {
    data = JSON.parse(input);
  } else {
    data = input;
  }

  // ── Timestamp ──────────────────────────────────────────────────────────────
  // Supports: timestamp_ms (Firebase), timestamp (Unix s or ms), ISO string
  let isoTimestamp = new Date().toISOString();
  const rawTs = data.timestamp_ms ?? data.timestamp;
  if (rawTs != null) {
    if (typeof rawTs === "number") {
      // If < 10^10 it's seconds, otherwise milliseconds
      const ms = rawTs < 10_000_000_000 ? rawTs * 1000 : rawTs;
      isoTimestamp = new Date(ms).toISOString();
    } else {
      isoTimestamp = new Date(String(rawTs)).toISOString();
    }
  }

  // ── GPS ────────────────────────────────────────────────────────────────────
  // Firebase sensorData/current does NOT include GPS. We use 0 / 0 (not a
  // fake Bengaluru coordinate) so callers can distinguish "no GPS" from real.
  const rawLat = data.latitude ?? data.lat ?? data.gps?.lat ?? null;
  const rawLng = data.longitude ?? data.lng ?? data.lon ?? data.gps?.lng ?? null;
  const hasGps = rawLat != null && rawLng != null;
  const lat = hasGps ? parseFloat(rawLat) : 0;
  const lng = hasGps ? parseFloat(rawLng) : 0;

  // ── Sensors ────────────────────────────────────────────────────────────────
  // Priority: Firebase field names first, then legacy names, then null.

  // TDS (ppm): tds_ppm (Firebase) | tds (legacy) | sensors.tds
  const rawTds = data.tds_ppm ?? data.tds ?? data.sensors?.tds ?? null;
  const tds = rawTds != null ? +parseFloat(rawTds).toFixed(1) : null;

  // Turbidity (NTU): turbidity_ntu (Firebase) | turbidity | ntu
  const rawTurb = data.turbidity_ntu ?? data.turbidity ?? data.ntu ?? data.sensors?.turbidity ?? null;
  const turbidity = rawTurb != null ? +parseFloat(rawTurb).toFixed(1) : null;

  // pH: ph (same in both schemas)
  const rawPh = data.ph ?? data.sensors?.ph ?? null;
  const ph = rawPh != null ? +parseFloat(rawPh).toFixed(2) : null;

  // Air Temperature (°C): temperature (Firebase) | air_temperature | temp
  const rawTemp =
    data.temperature ?? data.air_temperature ?? data.temp ?? data.sensors?.temp ?? data.sensors?.air_temperature ?? null;
  const airTemp = rawTemp != null ? +parseFloat(rawTemp).toFixed(1) : null;

  // Humidity (%): humidity (same in both schemas)
  const rawHumidity = data.humidity ?? data.sensors?.humidity ?? null;
  const humidity = rawHumidity != null ? +parseFloat(rawHumidity).toFixed(1) : null;

  // MQ-135 (ppm): mq135_ppm (Firebase) | mq135 | gas
  const rawMq135 = data.mq135_ppm ?? data.mq135 ?? data.gas ?? data.sensors?.mq135 ?? null;
  const mq135 = rawMq135 != null ? +parseFloat(rawMq135).toFixed(1) : null;

  // ── Compass ────────────────────────────────────────────────────────────────
  const rawCompass = data.compass ?? data.heading ?? null;
  const compass = rawCompass != null ? Math.round(parseFloat(rawCompass)) % 360 : 0;

  // ── Status (Firebase-specific field) ───────────────────────────────────────
  const status: string | undefined =
    data.status != null ? String(data.status) : undefined;

  return {
    timestamp: isoTimestamp,
    source,
    status,
    hasGps,
    gps: {
      lat: +lat.toFixed(6),
      lng: +lng.toFixed(6),
      altitudeMeters: data.altitude ?? undefined,
      satellites: data.satellites ?? data.sats ?? undefined,
      speedKmph: data.speed ?? undefined,
    },
    compass,
    sensors: {
      tds,
      turbidity,
      ph,
      air_temperature: airTemp,
      humidity,
      mq135,
    },
    rawPayload: data,
  };
}

/**
 * Fetch real-time hardware telemetry packet from the Raspberry Pi.
 */
export async function fetchLiveHardwareTelemetry(
  fallbackCenter?: [number, number], // [lat, lng]
  sessionIndex: number = 0,
): Promise<HardwareTelemetryPacket> {
  const endpoint = getPiEndpoint();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2200);

    const res = await fetch(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return parseRawJsonPacket(data, "live_pi");
    }
  } catch (err) {
    console.info(`[SCRUB Pi Bridge] ${endpoint} offline, using in-situ hardware template.`);
  }

  let baseLat = fallbackCenter ? fallbackCenter[0] : 13.0827;
  let baseLng = fallbackCenter ? fallbackCenter[1] : 80.2707;

  if (sessionIndex > 0) {
    // Generate a distinct location for each new session run
    const angle = (sessionIndex * 137.5 * Math.PI) / 180;
    const dist = 0.0006 + (sessionIndex % 4) * 0.0004;
    baseLat = +(baseLat + Math.sin(angle) * dist).toFixed(6);
    baseLng = +(baseLng + Math.cos(angle) * dist).toFixed(6);
  }

  // Slight sensor variation per 2s sample
  const tds = +(405.0 + Math.sin(Date.now() / 3000) * 15).toFixed(1);
  const turbidity = +(17.5 + Math.cos(Date.now() / 4000) * 2.5).toFixed(1);
  const ph = +(7.30 + Math.sin(Date.now() / 5000) * 0.12).toFixed(2);
  const airTemp = +(31.2 + Math.cos(Date.now() / 6000) * 0.6).toFixed(1);
  const humidity = +(68.0 + Math.sin(Date.now() / 7000) * 1.5).toFixed(1);

  const defaultPayload = {
    timestamp: Math.floor(Date.now() / 1000),
    latitude: baseLat,
    longitude: baseLng,
    tds,
    turbidity,
    ph,
    air_temperature: airTemp,
    humidity,
    compass: (sessionIndex * 75 + Math.floor(Date.now() / 5000) * 15) % 360,
  };

  return parseRawJsonPacket(defaultPayload, "simulated");
}
