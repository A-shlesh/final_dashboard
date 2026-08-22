import { initializeApp, deleteApp, getApps, type FirebaseApp } from "firebase/app";
import { getDatabase, ref, onValue, get, type Database } from "firebase/database";
import {
  getFirestore,
  doc,
  onSnapshot,
  type Firestore,
} from "firebase/firestore";
import { parseRawJsonPacket, type HardwareTelemetryPacket } from "./robot-telemetry-service";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface FirebaseConfigState {
  apiKey: string;
  databaseURL: string;
  projectId: string;
  /** Firebase RTDB node path, e.g. "sensorData/current" */
  telemetryPath: string;
  serviceType: "rtdb" | "firestore" | "rest";
  authDomain?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

export interface FirebaseTestResult {
  ok: boolean;
  /** Human-readable message */
  message: string;
  /** The raw Firebase node value if the read succeeded */
  rawData?: Record<string, any>;
  /** The parsed packet if available */
  packet?: HardwareTelemetryPacket;
  /** Specific error category */
  errorKind?:
    | "config_missing"
    | "invalid_url"
    | "permission_denied"
    | "path_empty"
    | "malformed_data"
    | "network"
    | "unknown";
}

// ─────────────────────────────────────────────────────────────────────────────
// Default configuration — pre-filled with the SCRUB v4 project credentials.
// Users can override via the Gateway Settings modal or .env vars.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_FIREBASE_CONFIG: FirebaseConfigState = {
  apiKey:
    (import.meta.env.VITE_FIREBASE_API_KEY as string) ||
    "AIzaSyCZcUkgZGlVvZnm-BV4oiO8NZ4F7A8e9rU",
  databaseURL:
    (import.meta.env.VITE_FIREBASE_DATABASE_URL as string) ||
    "https://scrub-v4-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:
    (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || "scrub-v4",
  telemetryPath:
    (import.meta.env.VITE_FIREBASE_TELEMETRY_PATH as string) ||
    "sensorData/current",
  serviceType: "rtdb",
  authDomain:
    (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) ||
    "scrub-v4.firebaseapp.com",
  storageBucket:
    (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) ||
    "scrub-v4.firebasestorage.app",
  messagingSenderId:
    (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) ||
    "984022165050",
  appId:
    (import.meta.env.VITE_FIREBASE_APP_ID as string) ||
    "1:984022165050:web:c1c1f232bb985816cab703",
};

const STORAGE_KEY = "scrub_firebase_config_v1";
const APP_NAME = "SCRUB_FIREBASE_APP";

// ─────────────────────────────────────────────────────────────────────────────
// Config persistence helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getFirebaseConfig(): FirebaseConfigState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<FirebaseConfigState>;
      return { ...DEFAULT_FIREBASE_CONFIG, ...parsed };
    }
  } catch (err) {
    console.warn("[scrub firebase] error reading config from localStorage", err);
  }
  return DEFAULT_FIREBASE_CONFIG;
}

export function saveFirebaseConfig(config: Partial<FirebaseConfigState>) {
  try {
    const current = getFirebaseConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn("[scrub firebase] error saving config", err);
    return getFirebaseConfig();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Firebase App lifecycle
//
// We always delete and re-create the named app when config has changed so that
// a stale app with old credentials does not persist across settings saves.
// ─────────────────────────────────────────────────────────────────────────────

export async function getOrCreateFirebaseApp(
  cfg?: FirebaseConfigState,
): Promise<FirebaseApp | null> {
  const config = cfg || getFirebaseConfig();

  if (!config.apiKey || !config.databaseURL) {
    console.warn("[scrub firebase] missing apiKey or databaseURL — cannot initialize app");
    return null;
  }

  // Build options object
  const options: Record<string, string> = {
    apiKey: config.apiKey,
    databaseURL: config.databaseURL,
    projectId: config.projectId || "",
    authDomain:
      config.authDomain || (config.projectId ? `${config.projectId}.firebaseapp.com` : ""),
    storageBucket:
      config.storageBucket || (config.projectId ? `${config.projectId}.appspot.com` : ""),
  };
  if (config.messagingSenderId) options.messagingSenderId = config.messagingSenderId;
  if (config.appId) options.appId = config.appId;

  // Delete existing app so we can reinitialize with fresh credentials
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) {
    try {
      await deleteApp(existing);
    } catch {
      /* ignore — best effort */
    }
  }

  try {
    return initializeApp(options, APP_NAME);
  } catch (err) {
    console.error("[scrub firebase] initializeApp failed", err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Synchronous app getter (for real-time listener setup)
// Re-uses the existing named app or creates a fresh one synchronously.
// ─────────────────────────────────────────────────────────────────────────────

function getOrInitAppSync(config: FirebaseConfigState): FirebaseApp | null {
  if (!config.apiKey || !config.databaseURL) return null;

  const options: Record<string, string> = {
    apiKey: config.apiKey,
    databaseURL: config.databaseURL,
    projectId: config.projectId || "",
    authDomain:
      config.authDomain || (config.projectId ? `${config.projectId}.firebaseapp.com` : ""),
    storageBucket:
      config.storageBucket || (config.projectId ? `${config.projectId}.appspot.com` : ""),
  };
  if (config.messagingSenderId) options.messagingSenderId = config.messagingSenderId;
  if (config.appId) options.appId = config.appId;

  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;

  try {
    return initializeApp(options, APP_NAME);
  } catch (err) {
    console.error("[scrub firebase] initializeApp (sync) failed", err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalize telemetry path
// ─────────────────────────────────────────────────────────────────────────────

function normalizePath(raw: string, fallback = "sensorData/current"): string {
  const trimmed = raw?.trim().replace(/^\/+|\/+$/g, "");
  return trimmed || fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Firebase connectivity — used by the "Test Firebase" button
// Returns detailed diagnostics including the raw Firebase node value.
// ─────────────────────────────────────────────────────────────────────────────

export async function testFirebaseConnection(
  cfg?: FirebaseConfigState,
): Promise<FirebaseTestResult> {
  const config = cfg || getFirebaseConfig();

  // 1. Validate config fields
  if (!config.apiKey || !config.databaseURL) {
    return {
      ok: false,
      message: "Firebase configuration error: API Key and Database URL are required.",
      errorKind: "config_missing",
    };
  }

  if (!config.databaseURL.startsWith("https://")) {
    return {
      ok: false,
      message: `Invalid Database URL: "${config.databaseURL}". Must start with https://`,
      errorKind: "invalid_url",
    };
  }

  const path = normalizePath(config.telemetryPath);

  // 2. Try SDK get() so we get proper error codes (permission-denied etc.)
  try {
    const app = await getOrCreateFirebaseApp(config);
    if (!app) {
      return {
        ok: false,
        message: "Firebase app could not be initialized. Check your API Key and Database URL.",
        errorKind: "config_missing",
      };
    }

    const db: Database = getDatabase(app);
    const dbRef = ref(db, path);

    const snapshot = await get(dbRef);

    if (!snapshot.exists()) {
      return {
        ok: false,
        message: `Firebase connected, but no telemetry found at "${path}".\n\nVerify your telemetry path in Gateway Settings. The Raspberry Pi may not have published data yet.`,
        errorKind: "path_empty",
      };
    }

    const rawData = snapshot.val() as Record<string, any>;

    // Validate the node looks like sensor data
    const knownSensorKeys = [
      "tds_ppm", "tds", "turbidity_ntu", "turbidity",
      "ph", "temperature", "air_temperature", "humidity",
      "mq135_ppm", "mq135",
    ];
    const foundKeys = knownSensorKeys.filter((k) => rawData[k] != null);
    const missingKeys = knownSensorKeys
      .filter((k) => !["tds", "turbidity", "air_temperature", "mq135"].includes(k)) // de-dup legacy aliases
      .filter((k) => rawData[k] == null);

    let packet: HardwareTelemetryPacket | undefined;
    try {
      packet = parseRawJsonPacket(rawData, "live_pi");
    } catch {
      return {
        ok: false,
        message: `Firebase node at "${path}" returned malformed data that could not be parsed.`,
        errorKind: "malformed_data",
        rawData,
      };
    }

    const sensorSummary = [
      packet.sensors.tds != null ? `TDS: ${packet.sensors.tds} ppm` : null,
      packet.sensors.turbidity != null ? `Turbidity: ${packet.sensors.turbidity} NTU` : null,
      packet.sensors.ph != null ? `pH: ${packet.sensors.ph}` : null,
      packet.sensors.air_temperature != null
        ? `Temp: ${packet.sensors.air_temperature} °C`
        : null,
      packet.sensors.humidity != null ? `Humidity: ${packet.sensors.humidity} %` : null,
      packet.sensors.mq135 != null ? `MQ-135: ${packet.sensors.mq135} ppm` : null,
      rawData.status != null ? `Status: ${rawData.status}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      ok: true,
      message:
        `✅ Firebase connected! Reading "${path}" — ${sensorSummary || "No sensor values found in node"}` +
        (foundKeys.length === 0
          ? "\n\n⚠️ No recognizable sensor fields found. Check that sensorData/current contains tds_ppm, turbidity_ntu, ph, temperature, humidity, mq135_ppm."
          : ""),
      rawData,
      packet,
    };
  } catch (err: any) {
    const code: string = err?.code || "";
    const msg: string = err?.message || String(err);

    if (code === "PERMISSION_DENIED" || msg.includes("permission") || msg.includes("401")) {
      return {
        ok: false,
        message:
          `Firebase Security Rules denied access to "${path}".\n\nIn the Firebase Console, set Realtime Database rules to allow read:\n{\n  "rules": {\n    ".read": true,\n    ".write": false\n  }\n}`,
        errorKind: "permission_denied",
      };
    }

    if (
      code === "NETWORK_ERROR" ||
      err?.name === "AbortError" ||
      msg.includes("network") ||
      msg.includes("fetch")
    ) {
      return {
        ok: false,
        message: `Network error: Cannot reach Firebase at "${config.databaseURL}".\nCheck internet connection and Database URL.`,
        errorKind: "network",
      };
    }

    return {
      ok: false,
      message: `Firebase error (${code || "unknown"}): ${msg}`,
      errorKind: "unknown",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy REST fetcher — kept for backward compat / REST fallback mode
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchFirebaseTelemetryREST(
  cfg?: FirebaseConfigState,
): Promise<HardwareTelemetryPacket | null> {
  const config = cfg || getFirebaseConfig();
  let url = config.databaseURL.trim();
  if (!url) return null;

  const path = normalizePath(config.telemetryPath);
  let restUrl = `${url.replace(/\/+$/, "")}/${path}.json`;
  if (config.apiKey) {
    restUrl += `?auth=${encodeURIComponent(config.apiKey)}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(restUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data == null) return null;
      if (typeof data === "object") {
        return parseRawJsonPacket(data as Record<string, any>, "live_pi");
      }
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn("[scrub firebase] REST fetch error", err);
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Real-time Firebase subscription
//
// Subscribes to the configured RTDB node (default: sensorData/current).
// Calls onData whenever the node changes.
// Returns an unsubscribe function — call it to remove the listener.
//
// Guarantees:
//  - Only one RTDB listener per subscription call.
//  - Calling the returned unsubscribe removes the listener immediately.
//  - Restarting the stream creates a fresh subscription (no duplicates if
//    the caller correctly called the previous unsubscribe first).
// ─────────────────────────────────────────────────────────────────────────────

export function subscribeToFirebaseTelemetry(
  onData: (packet: HardwareTelemetryPacket) => void,
  onError?: (err: Error, kind?: string) => void,
): () => void {
  const config = getFirebaseConfig();
  const path = normalizePath(config.telemetryPath);

  let isSubscribed = true;
  let rtdbUnsub: (() => void) | null = null;

  // ── RTDB SDK (preferred) ──────────────────────────────────────────────────
  if (config.apiKey && config.databaseURL) {
    const app = getOrInitAppSync(config);

    if (app) {
      try {
        const db: Database = getDatabase(app);
        const dbRef = ref(db, path);

        rtdbUnsub = onValue(
          dbRef,
          (snapshot) => {
            if (!isSubscribed) return;

            if (!snapshot.exists()) {
              console.warn(`[scrub firebase] RTDB node "${path}" is empty / does not exist.`);
              onError?.(
                new Error(`No data at Firebase path "${path}". Verify the telemetry path in Gateway Settings.`),
                "path_empty",
              );
              return;
            }

            const val = snapshot.val();

            // The sensorData/current node IS the flat sensor object.
            // Do NOT try to descend into sub-keys — parse it directly.
            try {
              const packet = parseRawJsonPacket(val as Record<string, any>, "live_pi");
              onData(packet);
            } catch (parseErr: any) {
              console.error("[scrub firebase] packet parse error", parseErr);
              onError?.(parseErr, "malformed_data");
            }
          },
          (error) => {
            if (!isSubscribed) return;
            console.error("[scrub firebase] RTDB onValue error", error);
            const kind =
              error.code === "PERMISSION_DENIED" ? "permission_denied" : "unknown";
            onError?.(error, kind);
          },
        );

        console.info(`[scrub firebase] RTDB listener attached to "${path}"`);

        return () => {
          isSubscribed = false;
          if (rtdbUnsub) {
            rtdbUnsub();
            rtdbUnsub = null;
            console.info(`[scrub firebase] RTDB listener removed from "${path}"`);
          }
        };
      } catch (err: any) {
        console.error("[scrub firebase] RTDB setup error", err);
        onError?.(err, "unknown");
      }
    }
  }

  // ── Firestore SDK (opt-in via serviceType) ────────────────────────────────
  if (config.projectId && config.serviceType === "firestore") {
    const app = getOrInitAppSync(config);
    if (app) {
      try {
        const db: Firestore = getFirestore(app);
        const docRef = doc(db, normalizePath(config.telemetryPath, "telemetry"), "latest");

        const fsUnsub = onSnapshot(
          docRef,
          (docSnap) => {
            if (!isSubscribed) return;
            if (docSnap.exists()) {
              const packet = parseRawJsonPacket(docSnap.data(), "live_pi");
              onData(packet);
            }
          },
          (error) => {
            if (!isSubscribed) return;
            console.error("[scrub firebase] Firestore onSnapshot error", error);
            onError?.(error, "unknown");
          },
        );

        return () => {
          isSubscribed = false;
          fsUnsub();
        };
      } catch (err: any) {
        console.error("[scrub firebase] Firestore setup error", err);
        onError?.(err, "unknown");
      }
    }
  }

  // ── REST polling fallback ─────────────────────────────────────────────────
  console.warn("[scrub firebase] Falling back to REST polling (SDK unavailable).");

  const poll = async () => {
    if (!isSubscribed) return;
    const packet = await fetchFirebaseTelemetryREST(config);
    if (packet && isSubscribed) onData(packet);
  };

  poll(); // immediate first fetch
  const intervalId = setInterval(poll, 2000);

  return () => {
    isSubscribed = false;
    clearInterval(intervalId);
  };
}
