import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  Activity,
  AlertTriangle,
  Compass,
  Crosshair,
  Gauge,
  History,
  MapPin,
  Navigation,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Send,
  Settings,
  Square,
  Trash2,
  Undo2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type LiveTelemetry,
  type DwellSample,
  type ConnectionStatus,
} from "@/hooks/use-live-telemetry";
import { WaypointList } from "./waypoint-list";
import { DwellView } from "./dwell-view";
import { MissionHistory } from "./mission-history";
import { CompassHud } from "@/components/combined/compass-hud";

const TOKEN =
  import.meta.env["VITE_MAPBOX_TOKEN"] as string | undefined;

if (!TOKEN) {
  throw new Error("Missing VITE_MAPBOX_TOKEN");
}

const DWELL_DURATION_S = 30;
const DWELL_SAMPLE_INTERVAL_S = 2;

type Waypoint = { lat: number; lon: number };
type WaypointStatus = "PENDING" | "ACTIVE" | "DONE";

const STATE_COLORS: Record<string, string> = {
  IDLE: "text-muted-foreground bg-secondary/50",
  RUNNING: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  PAUSED: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  DWELL: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
  MANUAL: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  COMPLETE: "text-primary bg-primary/10 border-primary/30",
  STOPPED: "text-red-400 bg-red-500/10 border-red-500/30",
  GEOFENCE_STOP: "text-red-400 bg-red-500/10 border-red-500/30",
  GPS_LOST: "text-amber-400 bg-amber-500/10 border-amber-500/30",
};

export function MissionPlanner({
  telemetry,
  dwellSample,
  connectionStatus,
  sendCommand,
  onOpenSettings,
}: {
  telemetry: LiveTelemetry | null;
  dwellSample: DwellSample | null;
  connectionStatus: ConnectionStatus;
  sendCommand: (cmd: Record<string, unknown>) => void;
  onOpenSettings: () => void;
}) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const waypointMarkers = useRef<mapboxgl.Marker[]>([]);
  const boatMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const lineSourceRef = useRef<mapboxgl.GeoJSONSource | null>(null);

  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [placeMode, setPlaceMode] = useState(false);
  const [manualOverride, setManualOverride] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [dwellSamples, setDwellSamples] = useState<Record<string, number>[]>([]);
  const [dwellCountdown, setDwellCountdown] = useState(0);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    mapboxgl.accessToken = TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [77.48698, 12.91686],
      zoom: 15,
    });

    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("waypoint-line", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "waypoint-line-layer",
        type: "line",
        source: "waypoint-line",
        paint: {
          "line-color": "#00e5ff",
          "line-width": 2,
          "line-dasharray": [2, 1],
        },
      });

      lineSourceRef.current = map.getSource(
        "waypoint-line",
      ) as mapboxgl.GeoJSONSource;
    });

    return () => {
      waypointMarkers.current.forEach((m) => m.remove());
      waypointMarkers.current = [];

      if (boatMarkerRef.current) {
        boatMarkerRef.current.remove();
      }

      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Map click handler for waypoint placement
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handler = (e: mapboxgl.MapMouseEvent) => {
      if (!placeMode) return;

      const wp = {
        lat: e.lngLat.lat,
        lon: e.lngLat.lng,
      };

      setWaypoints((prev) => [...prev, wp]);
    };

    map.on("click", handler);

    return () => {
      map.off("click", handler);
    };
  }, [placeMode]);

  // Sync waypoint markers on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    waypointMarkers.current.forEach((m) => m.remove());
    waypointMarkers.current = [];

    waypoints.forEach((wp, i) => {
      const status = getWaypointStatus(i, telemetry);

      const color =
        status === "DONE"
          ? "#22c55e"
          : status === "ACTIVE"
            ? "#00e5ff"
            : "#6b7280";

      const el = document.createElement("div");

      el.className =
        "flex size-7 items-center justify-center rounded-full border-2 font-mono text-[10px] font-bold text-white shadow-lg cursor-pointer";

      el.style.borderColor = color;
      el.style.backgroundColor = `${color}33`;
      el.innerText = String(i + 1);

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: "center",
      })
        .setLngLat([wp.lon, wp.lat])
        .addTo(map);

      waypointMarkers.current.push(marker);
    });

    // Update line source
    if (lineSourceRef.current && waypoints.length >= 2) {
      const coords = waypoints.map((wp) => [wp.lon, wp.lat]);

      lineSourceRef.current.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: coords,
            },
            properties: {},
          },
        ],
      });
    } else if (lineSourceRef.current) {
      lineSourceRef.current.setData({
        type: "FeatureCollection",
        features: [],
      });
    }
  }, [waypoints, telemetry?.current_waypoint_index]);

  // Boat marker
  useEffect(() => {
    const map = mapRef.current;

    if (!map || !telemetry) return;

    const el = document.createElement("div");

    el.className = "relative flex items-center justify-center";

    el.innerHTML = `
      <div class="absolute size-10 rounded-full bg-cyan-400/20 animate-ping"></div>
      <div class="relative flex size-8 items-center justify-center rounded-full border-2 border-white bg-cyan-500 shadow-2xl">
        <svg
          class="size-4 text-white"
          viewBox="0 0 24 24"
          fill="currentColor"
          stroke="currentColor"
          stroke-width="1.5"
          style="transform: rotate(${telemetry.heading_deg}deg)"
        >
          <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
        </svg>
      </div>
    `;

    if (!boatMarkerRef.current) {
      boatMarkerRef.current = new mapboxgl.Marker({
        element: el,
        anchor: "center",
      })
        .setLngLat([telemetry.lon, telemetry.lat])
        .addTo(map);
    } else {
      boatMarkerRef.current.setLngLat([telemetry.lon, telemetry.lat]);
      boatMarkerRef.current.getElement().innerHTML = el.innerHTML;
    }
  }, [telemetry?.lat, telemetry?.lon, telemetry?.heading_deg]);

  // Track dwell samples
  useEffect(() => {
    if (dwellSample) {
      setDwellSamples((prev) => [...prev, dwellSample.sensors]);
    }
  }, [dwellSample]);

  // Dwell countdown
  useEffect(() => {
    if (telemetry?.state === "DWELL") {
      setDwellSamples([]);
      setDwellCountdown(DWELL_DURATION_S);

      const interval = setInterval(() => {
        setDwellCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);

      return () => clearInterval(interval);
    }

    setDwellCountdown(0);
  }, [telemetry?.state]);

  const handleSendMission = useCallback(() => {
    if (waypoints.length === 0) return;

    sendCommand({
      type: "load_mission",
      waypoints,
    });
  }, [waypoints, sendCommand]);

  const handleUndo = useCallback(() => {
    setWaypoints((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setWaypoints([]);
  }, []);

  const handleManualOverride = useCallback(() => {
    const next = !manualOverride;

    setManualOverride(next);

    sendCommand({
      type: "set_manual",
      enabled: next,
    });
  }, [manualOverride, sendCommand]);

  const effectiveMode = telemetry?.effective_mode ?? "MANUAL";
  const isManual = effectiveMode === "MANUAL";
  const state = telemetry?.state ?? "IDLE";

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/80 bg-background/95 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Navigation className="size-3.5" />
          </div>

          <span className="font-display text-sm font-bold">
            Mission Control
          </span>

          <span
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase",
              STATE_COLORS[state] ?? "text-muted-foreground",
            )}
          >
            {state}
          </span>

          {isManual && (
            <span className="rounded border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-orange-400">
              {manualOverride ? "DASHBOARD OVERRIDE" : "RC MANUAL"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/90 px-2.5 py-1">
            <div
              className={cn(
                "size-2 rounded-full",
                connectionStatus === "connected"
                  ? "bg-emerald-500"
                  : connectionStatus === "connecting"
                    ? "bg-amber-500 animate-pulse"
                    : "bg-red-500",
              )}
            />

            <span className="font-mono text-[10px] uppercase text-muted-foreground">
              {connectionStatus}
            </span>
          </div>

          <button
            onClick={onOpenSettings}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Settings className="size-3.5" />
          </button>

          <button
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-xs font-semibold",
              showHistory
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <History className="size-3.5 inline mr-1" />
            History
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Left sidebar */}
        <div className="flex w-[320px] shrink-0 flex-col overflow-hidden border-r border-border/80 bg-background/95">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <span className="hud-label">
              Waypoints ({waypoints.length})
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPlaceMode(!placeMode)}
                className={cn(
                  "flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-semibold uppercase transition-colors",
                  placeMode
                    ? "border-cyan-400 bg-cyan-500/10 text-cyan-400 animate-pulse"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <Crosshair className="size-3" />
                {placeMode ? "Click Map..." : "Place"}
              </button>

              <button
                onClick={handleUndo}
                disabled={waypoints.length === 0}
                className="rounded border border-border p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <Undo2 className="size-3" />
              </button>

              <button
                onClick={handleClear}
                disabled={waypoints.length === 0}
                className="rounded border border-border p-1 text-muted-foreground hover:text-destructive disabled:opacity-30"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <WaypointList
              waypoints={waypoints}
              currentIndex={telemetry?.current_waypoint_index ?? -1}
              state={state}
            />
          </div>

          <div className="border-t border-border/60 px-3 py-2">
            <button
              onClick={handleSendMission}
              disabled={waypoints.length === 0 || isManual}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              <Send className="size-3.5" />
              Send Mission ({waypoints.length} waypoints)
            </button>
          </div>

          <div className="border-t border-border/60 px-3 py-2 space-y-2">
            <div className="grid grid-cols-4 gap-1.5">
              <button
                onClick={() => sendCommand({ type: "start" })}
                disabled={isManual}
                className="flex items-center justify-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 py-1.5 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-30"
              >
                <Play className="size-3" />
                Start
              </button>

              <button
                onClick={() => sendCommand({ type: "pause" })}
                disabled={isManual}
                className="flex items-center justify-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 py-1.5 text-[10px] font-bold text-amber-400 hover:bg-amber-500/20 disabled:opacity-30"
              >
                <Pause className="size-3" />
                Pause
              </button>

              <button
                onClick={() => sendCommand({ type: "stop" })}
                disabled={isManual}
                className="flex items-center justify-center gap-1 rounded border border-border py-1.5 text-[10px] font-bold text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <Square className="size-3" />
                Stop
              </button>

              <button
                onClick={() => sendCommand({ type: "emergency_stop" })}
                className="flex items-center justify-center gap-1 rounded border border-red-500/30 bg-red-500/10 py-1.5 text-[10px] font-bold text-red-400 hover:bg-red-500/20"
              >
                <Zap className="size-3" />
                E-Stop
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Gauge className="size-3 text-muted-foreground" />

              <input
                type="range"
                min={5}
                max={30}
                defaultValue={18}
                onChange={(e) =>
                  sendCommand({
                    type: "set_speed",
                    power: Number(e.target.value),
                  })
                }
                disabled={isManual}
                className="flex-1 accent-primary disabled:opacity-30"
              />

              <span className="font-mono text-[10px] text-muted-foreground w-8 text-right">
                pwr
              </span>
            </div>
          </div>

          <div className="border-t border-border/60 px-3 py-2">
            <button
              onClick={handleManualOverride}
              className={cn(
                "flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold transition-colors",
                manualOverride
                  ? "border-orange-500 bg-orange-500/15 text-orange-400"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <Radio className="size-3.5" />
              {manualOverride
                ? "DASHBOARD MANUAL ON"
                : "Manual Override"}
            </button>
          </div>
        </div>

        {/* Center map */}
        <main className="relative flex-1">
          <div ref={mapContainer} className="absolute inset-0" />

          {placeMode && (
            <div className="absolute top-3 left-1/2 z-[500] -translate-x-1/2 rounded-full border border-cyan-400/50 bg-background/95 px-4 py-1.5 text-xs font-semibold text-cyan-400 shadow-2xl backdrop-blur-md animate-pulse">
              Click on the map to place waypoints
            </div>
          )}
        </main>

        {/* Right panel */}
        <div className="flex w-[340px] shrink-0 flex-col overflow-hidden border-l border-border/80 bg-background/95">
          {telemetry && (
            <div className="border-b border-border/60 p-2">
              <CompassHud
                heading={telemetry.heading_deg}
                speed={telemetry.speed_mps}
                satellites={telemetry.satellites}
                lat={telemetry.lat}
                lon={telemetry.lon}
              />
            </div>
          )}

          {state === "DWELL" && (
            <DwellView
              countdown={dwellCountdown}
              totalSeconds={DWELL_DURATION_S}
              samples={dwellSamples}
              waypointIndex={
                telemetry?.current_waypoint_index ?? 0
              }
            />
          )}

          {telemetry && state !== "DWELL" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <div className="hud-label">Live Sensors</div>

              {Object.entries(telemetry.sensors).map(([key, val]) => (
                <div
                  key={key}
                  className="flex items-center justify-between border border-border/60 bg-secondary/20 px-2.5 py-1.5"
                >
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">
                    {key}
                  </span>

                  <span className="font-mono text-sm font-bold text-foreground">
                    {typeof val === "number"
                      ? val.toFixed(2)
                      : val}
                  </span>
                </div>
              ))}

              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <div className="border border-border/60 bg-secondary/20 px-2.5 py-1.5">
                  <span className="hud-label text-[8px]">
                    L POWER
                  </span>
                  <div className="font-mono text-sm font-bold text-foreground">
                    {telemetry.left_power}
                  </div>
                </div>

                <div className="border border-border/60 bg-secondary/20 px-2.5 py-1.5">
                  <span className="hud-label text-[8px]">
                    R POWER
                  </span>
                  <div className="font-mono text-sm font-bold text-foreground">
                    {telemetry.right_power}
                  </div>
                </div>
              </div>
            </div>
          )}

          {showHistory && (
            <div className="border-t border-border/60">
              <MissionHistory />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getWaypointStatus(
  index: number,
  telemetry: LiveTelemetry | null,
): WaypointStatus {
  if (!telemetry) return "PENDING";

  if (index < telemetry.current_waypoint_index) {
    return "DONE";
  }

  if (
    index === telemetry.current_waypoint_index &&
    telemetry.state === "RUNNING"
  ) {
    return "ACTIVE";
  }

  if (
    index === telemetry.current_waypoint_index &&
    telemetry.state === "DWELL"
  ) {
    return "ACTIVE";
  }

  return "PENDING";
}