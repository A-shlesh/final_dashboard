import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy, useCallback, useMemo, useRef, useState, useEffect } from "react";
import * as turf from "@turf/turf";
import { ClearLakeModal } from "@/components/live/clear-lake-modal";
import { DetailPanel } from "@/components/live/detail-panel";
import { LocationSearchBar } from "@/components/live/location-search-bar";
import { LiveStreamHud } from "@/components/live/live-stream-hud";
import { LiveTelemetryModal } from "@/components/live/live-telemetry-modal";
import { PiSettingsModal } from "@/components/live/pi-settings-modal";
import { LiveVideoPanel } from "@/components/live/live-video-panel";
import { AnalyticsModal } from "@/components/live/analytics-modal";
import { ThreatsModal } from "@/components/live/threats-modal";
import { BASEMAPS, MapHud } from "@/components/live/map-hud";
import type { MapHandle } from "@/components/live/live-map";
import {
  fetchLiveHardwareTelemetry,
  type HardwareTelemetryPacket,
} from "@/lib/robot-telemetry-service";
import { subscribeToFirebaseTelemetry } from "@/lib/firebase-telemetry-service";
import {
  strHash,
  type GridSensorData,
  type LakeEntity,
} from "@/lib/water-data";
import { useKeyboardArrowNav } from "@/lib/keyboard-nav";
import {
  Activity,
  Crosshair,
  Layers,
  Play,
  Plus,
  RefreshCw,
  Settings,
  ShieldAlert,
  Square,
  Trash2,
  Video,
} from "lucide-react";
import LiveMap from "@/components/live/live-map";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SCRUB — Basin Observatory & Water Quality Intelligence" },
      {
        name: "description",
        content:
          "Professional environmental water quality intelligence platform for Bengaluru's lakes: uniform grid generation, 8-channel IoT telemetry (MQ-135, Turbidity, pH, TDS, DHT, GPS, Compass), and dynamic lake-level aggregations.",
      },
    ],
  }),
  component: BasinObservatory,
});

function BasinObservatory() {
  const [lakes, setLakes] = useState<LakeEntity[]>(() => {
    try {
      const saved = localStorage.getItem("scrub_registered_lakes_v2");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      /* fallback */
    }
    return [];
  });

  const [draftLake, setDraftLake] = useState<LakeEntity | null>(null);
  const [selectedLakeId, setSelectedLakeId] = useState<string | null>(null);
  const [selectedGrid, setSelectedGrid] = useState<GridSensorData | null>(null);
  const [styleId, setStyleId] = useState(BASEMAPS[0]!.id);
  const [isDetectingWater, setIsDetectingWater] = useState(false);
  const [isEditingBoundary, setIsEditingBoundary] = useState(false);
  const [clearModalLake, setClearModalLake] = useState<LakeEntity | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Real-Time 0.5Hz Streaming States (2-second lag)
  const [isStreaming, setIsStreaming] = useState(false);
  const [isFetchingTelemetry, setIsFetchingTelemetry] = useState(false);
  const [latestPacket, setLatestPacket] = useState<HardwareTelemetryPacket | null>(null);
  const [lockedGps, setLockedGps] = useState<{ lat: number; lng: number; compass: number } | null>(null);
  const [streamPacketCount, setStreamPacketCount] = useState(0);
  const [isTelemetryModalOpen, setIsTelemetryModalOpen] = useState(false);
  const [isPiSettingsOpen, setIsPiSettingsOpen] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isThreatsOpen, setIsThreatsOpen] = useState(false);
  const [robotLocation, setRobotLocation] = useState<{
    lat: number;
    lng: number;
    compass: number;
  } | null>(null);

  const [showStreamHud, setShowStreamHud] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const sessionRunIndexRef = useRef(0);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const firebaseUnsubRef = useRef<(() => void) | null>(null);
  const mapHandle = useRef<MapHandle | null>(null);
  const topNavRef = useKeyboardArrowNav<HTMLElement>(true);

  useEffect(() => {
    try {
      localStorage.setItem("scrub_registered_lakes_v2", JSON.stringify(lakes));
    } catch {
      /* noop */
    }
  }, [lakes]);

  const selectedLake = useMemo(() => {
    return lakes.find((l) => l.id === selectedLakeId) ?? null;
  }, [lakes, selectedLakeId]);

  const handleSelectLake = useCallback((lake: LakeEntity | null) => {
    if (lake) {
      setSelectedLakeId(lake.id);
      setSelectedGrid(null);
      mapHandle.current?.flyTo(lake.lng, lake.lat, 15.2);
    } else {
      setSelectedLakeId(null);
      setSelectedGrid(null);
    }
  }, []);

  const handleSelectGrid = useCallback((grid: GridSensorData | null) => {
    setSelectedGrid(grid);
  }, []);

  // When a real water body is clicked on the map
  const handleWaterDetected = useCallback(
    ({
      name,
      zone,
      lng,
      lat,
      areaHa,
      boundary,
    }: {
      name: string;
      zone: string;
      lng: number;
      lat: number;
      areaHa: number;
      boundary: [number, number][];
    }) => {
      const id = `lake-${strHash(name + Date.now())}`;
      const newDraft: LakeEntity = {
        id,
        name,
        zone: zone || "South",
        lat,
        lng,
        areaHa,
        coveragePct: 0,
        startPoint: [+(lng - 0.0015).toFixed(6), +(lat - 0.0015).toFixed(6)],
        boundaryLocked: false,
        boundary,
        lastDeployment: new Date().toISOString(),
        robotUnit: `SCRUB-R${Math.floor(100 + Math.random() * 900)}`,
      };

      // Set as draft so user can edit name/zone/vertices before saving
      setDraftLake(newDraft);
      setSelectedLakeId(null);
      setSelectedGrid(null);
      setIsDetectingWater(false);
      setIsEditingBoundary(true); // Opens the floating Save & Edit toolbar!
    },
    [],
  );

  const handleSaveCustomBoundary = useCallback(
    (
      lakeId: string,
      boundaryPoints: [number, number][],
      name?: string,
      zone?: string,
    ) => {
      if (draftLake) {
        // Officially commit the drafted lake into registered lakes list
        const finalLake: LakeEntity = {
          ...draftLake,
          name: name || draftLake.name,
          zone: zone || draftLake.zone,
          boundary: boundaryPoints,
          boundaryLocked: true, // Permanent lock after save
        };
        setLakes((prev) => [finalLake, ...prev]);
        setSelectedLakeId(finalLake.id);
        setDraftLake(null);
      } else {
        setLakes((prev) =>
          prev.map((l) => {
            if (l.id === lakeId) {
              return {
                ...l,
                name: name || l.name,
                zone: zone || l.zone,
                boundary: boundaryPoints,
                boundaryLocked: true,
              };
            }
            return l;
          }),
        );
      }
      setIsEditingBoundary(false);
      setIsDetectingWater(false);
    },
    [draftLake],
  );

  const handleCancelEditBoundary = useCallback(() => {
    setDraftLake(null);
    setIsEditingBoundary(false);
    setIsDetectingWater(false);
  }, []);

  const handleClearLake = useCallback(
    (lakeId: string) => {
      setLakes((prev) => prev.filter((l) => l.id !== lakeId));
      if (selectedLakeId === lakeId) {
        setSelectedLakeId(null);
        setSelectedGrid(null);
      }
    },
    [selectedLakeId],
  );

  /**
   * 0.5 Hz (2-second lag) Polling Tick
   * Keeps GPS static at locked location and updates sensor readings continuously
   */
  const pollTelemetryTick = useCallback(
    async (currentLockedGps: { lat: number; lng: number; compass: number }) => {
      try {
        const packet = await fetchLiveHardwareTelemetry([
          currentLockedGps.lat,
          currentLockedGps.lng,
        ]);

        // Keep GPS static at the locked point
        packet.gps.lat = currentLockedGps.lat;
        packet.gps.lng = currentLockedGps.lng;
        packet.compass = currentLockedGps.compass;

        // Triangulate inside lakes
        const robotPoint = turf.point([currentLockedGps.lng, currentLockedGps.lat]);
        let matchedLake: LakeEntity | null = null;
        let matchedGridCell: GridSensorData | null = null;

        for (const lake of lakes) {
          if (lake.boundary && lake.boundary.length >= 3) {
            try {
              const poly = turf.polygon([[...lake.boundary, lake.boundary[0]!]]);
              if (turf.booleanPointInPolygon(robotPoint, poly)) {
                matchedLake = lake;
                break;
              }
            } catch {
              /* noop */
            }
          }
        }

        if (matchedLake && matchedLake.grids && matchedLake.grids.length > 0) {
          let bestDist = Infinity;
          for (const g of matchedLake.grids) {
            const d =
              (g.gps[0] - currentLockedGps.lat) ** 2 + (g.gps[1] - currentLockedGps.lng) ** 2;
            if (d < bestDist) {
              bestDist = d;
              matchedGridCell = g;
            }
          }

          if (matchedGridCell) {
            packet.matchedGridCode = matchedGridCell.code;
            packet.matchedLakeName = matchedLake.name;

            // Automatically update grid cell values in real-time
            setLakes((prev) =>
              prev.map((l) => {
                if (l.id === matchedLake!.id && l.grids) {
                  const updated = l.grids.map((grid) => {
                    if (grid.code === matchedGridCell!.code) {
                      return {
                        ...grid,
                        state: "cleaned" as const,
                        tds: packet.sensors.tds ?? grid.tds,
                        turbidity: packet.sensors.turbidity ?? grid.turbidity,
                        ph: packet.sensors.ph ?? grid.ph,
                        dhtTemp: packet.sensors.air_temperature ?? grid.dhtTemp,
                        dhtHumidity: packet.sensors.humidity ?? grid.dhtHumidity,
                      };
                    }
                    return grid;
                  });
                  return { ...l, grids: updated };
                }
                return l;
              }),
            );
          }
        }

        setLatestPacket(packet);
        setStreamPacketCount((c) => c + 1);
      } catch (err) {
        console.error("[scrub] stream poll error", err);
      }
    },
    [lakes],
  );

  /**
   * FIREBASE LIVE PACKET HANDLER:
   * Receives real-time sensor data from Firebase sensorData/current.
   * GPS is NOT provided by Firebase — hasGps flag guards map updates.
   */
  const handleFirebasePacket = useCallback(
    (packet: HardwareTelemetryPacket) => {
      setLatestPacket(packet);
      setStreamPacketCount((c) => c + 1);
      setFirebaseError(null);

      // Only update GPS / robot marker when the packet actually carries coordinates
      if (packet.hasGps && packet.gps.lat !== 0 && packet.gps.lng !== 0) {
        const liveGps = {
          lat: packet.gps.lat,
          lng: packet.gps.lng,
          compass: packet.compass,
        };
        setLockedGps(liveGps);
        setRobotLocation(liveGps);
        // Smoothly track / focus to live GPS on map
        mapHandle.current?.flyTo(packet.gps.lng, packet.gps.lat, 16.2);

        // Check if live GPS matches any registered lake & survey sector
        const robotPoint = turf.point([packet.gps.lng, packet.gps.lat]);
        let matchedLake: LakeEntity | null = null;
        let matchedGridCell: GridSensorData | null = null;

        for (const lake of lakes) {
          if (lake.boundary && lake.boundary.length >= 3) {
            try {
              const poly = turf.polygon([[...lake.boundary, lake.boundary[0]!]]);
              if (turf.booleanPointInPolygon(robotPoint, poly)) {
                matchedLake = lake;
                break;
              }
            } catch {
              /* noop */
            }
          }
        }

        if (matchedLake && matchedLake.grids && matchedLake.grids.length > 0) {
          let bestDist = Infinity;
          for (const g of matchedLake.grids) {
            const d = (g.gps[0] - packet.gps.lat) ** 2 + (g.gps[1] - packet.gps.lng) ** 2;
            if (d < bestDist) {
              bestDist = d;
              matchedGridCell = g;
            }
          }

          if (matchedGridCell) {
            packet.matchedGridCode = matchedGridCell.code;
            packet.matchedLakeName = matchedLake.name;
            setSelectedLakeId(matchedLake.id);
            setSelectedGrid(matchedGridCell);

            setLakes((prev) =>
              prev.map((l) => {
                if (l.id === matchedLake!.id) {
                  const updated = (l.grids ?? []).map((grid) => {
                    if (grid.id === matchedGridCell!.id) {
                      return {
                        ...grid,
                        state: "cleaned" as const,
                        tds: packet.sensors.tds ?? grid.tds,
                        turbidity: packet.sensors.turbidity ?? grid.turbidity,
                        ph: packet.sensors.ph ?? grid.ph,
                        dhtTemp: packet.sensors.air_temperature ?? grid.dhtTemp,
                        dhtHumidity: packet.sensors.humidity ?? grid.dhtHumidity,
                      };
                    }
                    return grid;
                  });
                  return { ...l, grids: updated };
                }
                return l;
              }),
            );
          }
        }
      }
      // If no GPS in this Firebase packet, sensor values still arrive and update
      // the HUD — the robot marker simply stays at its last known position.
    },
    [lakes],
  );


  /**
   * STOP STREAM BUTTON:
   * Permanently stops the Firebase listener or 0.5Hz polling loop
   */
  const handleStopStream = useCallback(() => {
    setIsStreaming(false);
    if (firebaseUnsubRef.current) {
      firebaseUnsubRef.current();
      firebaseUnsubRef.current = null;
    }
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
  }, []);

  /**
   * START STREAM BUTTON:
   * Connects to active gateway (Firebase Cloud Stream or local Raspberry Pi)
   */
  const handleStartStream = useCallback(async () => {
    setIsFetchingTelemetry(true);
    setFirebaseError(null);
    try {
      sessionRunIndexRef.current += 1;
      const gatewaySource = localStorage.getItem("scrub_active_gateway_source") || "firebase";

      setShowStreamHud(true);
      setIsStreaming(true);

      if (gatewaySource === "firebase") {
        if (firebaseUnsubRef.current) {
          firebaseUnsubRef.current();
        }
        firebaseUnsubRef.current = subscribeToFirebaseTelemetry(
          handleFirebasePacket,
          (err, kind) => {
            console.error("[scrub] firebase stream error", err);
            setFirebaseError(err.message);
            if (kind === "permission_denied") {
              // Stop streaming on auth error — no point retrying
              handleStopStream();
            }
          },
        );
      } else {
        const fallbackCenter: [number, number] = selectedLake
          ? [selectedLake.lat, selectedLake.lng]
          : [13.0827, 80.2707];

        const initialPacket = await fetchLiveHardwareTelemetry(fallbackCenter, sessionRunIndexRef.current);
        const initialGps = {
          lat: initialPacket.gps.lat,
          lng: initialPacket.gps.lng,
          compass: initialPacket.compass,
        };

        setLockedGps(initialGps);
        setRobotLocation(initialGps);
        mapHandle.current?.flyTo(initialGps.lng, initialGps.lat, 16.0);

        setLatestPacket(initialPacket);
        setStreamPacketCount(1);

        if (streamIntervalRef.current) {
          clearInterval(streamIntervalRef.current);
        }

        streamIntervalRef.current = setInterval(() => {
          pollTelemetryTick(initialGps);
        }, 2000);
      }
    } catch (err) {
      console.error("[scrub] start stream error", err);
    } finally {
      setIsFetchingTelemetry(false);
    }
  }, [selectedLake, pollTelemetryTick, handleFirebasePacket]);

  // Clean up interval timer and Firebase listener on unmount
  useEffect(() => {
    return () => {
      if (firebaseUnsubRef.current) {
        firebaseUnsubRef.current();
      }
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
      }
    };
  }, []);

  // Apply custom/pasted JSON packet
  const handleApplyManualJson = useCallback(
    (packet: HardwareTelemetryPacket) => {
      setLatestPacket(packet);
      const initialGps = {
        lat: packet.gps.lat,
        lng: packet.gps.lng,
        compass: packet.compass,
      };
      setLockedGps(initialGps);
      setRobotLocation(initialGps);
      mapHandle.current?.flyTo(packet.gps.lng, packet.gps.lat, 16.0);

      const robotPoint = turf.point([packet.gps.lng, packet.gps.lat]);
      let matchedLake: LakeEntity | null = null;
      let matchedGridCell: GridSensorData | null = null;

      for (const lake of lakes) {
        if (lake.boundary && lake.boundary.length >= 3) {
          try {
            const poly = turf.polygon([[...lake.boundary, lake.boundary[0]!]]);
            if (turf.booleanPointInPolygon(robotPoint, poly)) {
              matchedLake = lake;
              break;
            }
          } catch {
            /* noop */
          }
        }
      }

      if (matchedLake && matchedLake.grids && matchedLake.grids.length > 0) {
        let bestDist = Infinity;
        for (const g of matchedLake.grids) {
          const d = (g.gps[0] - packet.gps.lat) ** 2 + (g.gps[1] - packet.gps.lng) ** 2;
          if (d < bestDist) {
            bestDist = d;
            matchedGridCell = g;
          }
        }

        if (matchedGridCell) {
          packet.matchedGridCode = matchedGridCell.code;
          packet.matchedLakeName = matchedLake.name;
          setSelectedLakeId(matchedLake.id);
          setSelectedGrid(matchedGridCell);
        }
      }
    },
    [lakes],
  );

  return (
    <div className="dark relative flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      {/* ================= TOP NAVIGATION BAR ================= */}
      <header
        ref={topNavRef}
        className="z-[500] flex h-16 shrink-0 items-center justify-between border-b border-border/80 bg-background/95 px-6 shadow-sm backdrop-blur-md"
      >
        {/* Left Branding (SCRUB Observatory text, logo removed) */}
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <span className="font-display text-base font-bold tracking-tight text-foreground">
              SCRUB
            </span>
            <span className="rounded bg-primary/10 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-primary border border-primary/20">
              Observatory
            </span>
          </div>
          <div className="text-[10.5px] text-muted-foreground hidden sm:block">
            Bengaluru Water Quality & Environmental Intelligence
          </div>
        </div>

        {/* Center / Right Controls with clean balanced spacing */}
        <div className="flex items-center gap-2.5">
          {/* Area, Locality & Lake Search (Map Geocoder) */}
          <LocationSearchBar
            lakes={lakes}
            onNavigateToLocation={(lng, lat, zoom) => {
              mapHandle.current?.flyTo(lng, lat, zoom || 15.0);
            }}
            onSelectLake={handleSelectLake}
          />

          {/* Live Robot POV Video Stream Trigger */}
          <button
            onClick={() => setIsVideoOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all ${
              isVideoOpen
                ? "border-primary bg-primary text-primary-foreground font-bold shadow-md"
                : "border-border/80 bg-background/90 text-foreground hover:bg-accent"
            }`}
            title="Open Live RPi Camera Video Feed & Robot POV"
          >
            <Video className="size-3.5 text-primary" />
            <span className="hidden sm:inline">Video Feed</span>
          </button>

          {/* Reclamation Analytics Trigger */}
          <button
            onClick={() => setIsAnalyticsOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-accent transition-all"
            title="Open Basin & Lake Reclamation Analytics"
          >
            <Activity className="size-3.5 text-primary" />
            <span className="hidden sm:inline">Analytics</span>
          </button>

          {/* Threats & Anomaly Feed Trigger */}
          <button
            onClick={() => setIsThreatsOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-accent transition-all relative"
            title="Open Live Threat & Anomaly Surveillance Feed"
          >
            <ShieldAlert className="size-3.5 text-destructive" />
            <span className="hidden sm:inline">Threats</span>
            <span className="rounded-full bg-destructive px-1.5 py-0.2 text-[9px] font-bold text-destructive-foreground">
              2
            </span>
          </button>

          {/* Quick Add Lake Trigger */}
          <button
            onClick={() => setIsDetectingWater((prev) => !prev)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all ${
              isDetectingWater
                ? "border-cyan-400 bg-cyan-500 text-black font-bold animate-pulse"
                : "border-primary/40 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
            }`}
            title="Click on any lake on the map to detect boundary"
          >
            {isDetectingWater ? <Crosshair className="size-3.5" /> : <Plus className="size-3.5" />}
            <span className="hidden sm:inline">
              {isDetectingWater ? "Click on Lake..." : "Add Lake"}
            </span>
          </button>

          {/* ================= START / STOP STREAM BUTTON ================= */}
          <div className="flex items-center rounded-lg border border-border/80 bg-background/90 p-0.5 shadow-sm">
            {!isStreaming ? (
              <button
                onClick={handleStartStream}
                disabled={isFetchingTelemetry}
                className="flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-bold text-black transition-all hover:bg-emerald-400 disabled:opacity-60 shadow-sm"
                title="Lock GPS and start real-time 0.5Hz (2-second lag) sensor streaming"
              >
                {isFetchingTelemetry ? (
                  <RefreshCw className="size-3.5 animate-spin" />
                ) : (
                  <Play className="size-3.5 fill-current" />
                )}
                <span>{isFetchingTelemetry ? "Starting..." : "Start"}</span>
              </button>
            ) : (
              <button
                onClick={handleStopStream}
                className="flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground transition-all hover:opacity-90 shadow-sm animate-pulse"
                title="Stop real-time sensor streaming"
              >
                <Square className="size-3.5 fill-current" />
                <span>Stop</span>
              </button>
            )}

            <button
              onClick={() => setIsPiSettingsOpen(true)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors ml-0.5"
              title="Raspberry Pi IP / URL Configuration"
            >
              <Settings className="size-3.5" />
            </button>
          </div>

          {/* Basemap Switcher (Map / Satellite) */}
          <MapHud styleId={styleId} onStyle={setStyleId} />
        </div>
      </header>

      {/* ================= MAIN WORKSPACE ================= */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Left Floating Lake Catalog Drawer */}
        <div
          className={`absolute left-4 top-4 z-[400] flex max-h-[calc(100vh-5rem)] w-[260px] flex-col overflow-hidden rounded-xl border border-border/80 bg-background/90 shadow-2xl backdrop-blur-xl transition-all duration-300 ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-[calc(100%+1.5rem)]"
          }`}
        >
          <div className="flex items-center justify-between border-b border-border/70 p-3 bg-secondary/30">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Layers className="size-3.5 text-primary" />
              <span>Registered Lakes ({lakes.length})</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsDetectingWater(true)}
                className="rounded p-1 text-primary hover:bg-primary/10"
                title="Add new water body from map"
              >
                <Plus className="size-3.5" />
              </button>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="text-[10px] text-muted-foreground hover:text-foreground pl-1"
              >
                Hide
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {lakes.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground leading-relaxed">
                No lakes registered yet.
                <button
                  onClick={() => setIsDetectingWater(true)}
                  className="mt-2 block w-full rounded-md border border-dashed border-primary/50 py-2 font-medium text-primary hover:bg-primary/10"
                >
                  + Click on a lake to add
                </button>
              </div>
            ) : (
              lakes.map((l) => {
                const active = selectedLakeId === l.id;
                return (
                  <div
                    key={l.id}
                    className={`group flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-all ${
                      active
                        ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                        : "text-foreground hover:bg-accent/50"
                    }`}
                  >
                    <button
                      onClick={() => handleSelectLake(l)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate font-medium">{l.name}</div>
                      <div
                        className={`text-[10px] ${
                          active ? "text-primary-foreground/80" : "text-muted-foreground"
                        }`}
                      >
                        {l.areaHa} ha · Locked
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 ml-1.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setClearModalLake(l);
                        }}
                        className={`rounded p-1 transition-colors ${
                          active
                            ? "text-primary-foreground/70 hover:bg-black/20 hover:text-white"
                            : "text-muted-foreground opacity-70 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                        }`}
                        title={`Delete ${l.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                      <span
                        className={`size-2 rounded-full ${
                          active ? "bg-white" : "bg-emerald-500"
                        }`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Toggle button when left drawer is closed */}
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-4 top-4 z-[400] flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/90 px-3 py-1.5 text-xs font-semibold shadow-md backdrop-blur-md hover:bg-accent"
          >
            <Layers className="size-3.5 text-primary" />
            <span>Water Bodies ({lakes.length})</span>
          </button>
        )}

        {/* Center Map Workspace */}
        <main className="relative flex-1 h-full w-full overflow-hidden">
          <ClientOnly fallback={<div className="grid h-full place-items-center font-mono text-xs text-muted-foreground">INITIALISING OBSERVATORY MAP…</div>}>
            <LiveMap
              lakes={lakes}
              selectedLake={draftLake || selectedLake}
              selectedGridId={selectedGrid?.id ?? null}
              robotLocation={robotLocation}
              onSelectLake={handleSelectLake}
              onSelectGrid={handleSelectGrid}
              registerHandle={(h) => (mapHandle.current = h)}
              styleId={styleId}
              isDetectingWater={isDetectingWater}
              isEditingBoundary={isEditingBoundary}
              onWaterDetected={handleWaterDetected}
              onSaveCustomBoundary={handleSaveCustomBoundary}
              onCancelEditBoundary={handleCancelEditBoundary}
            />
          </ClientOnly>

          {/* Floating Live Stream HUD (Real-time 0.5Hz sensor stream) */}
          {(isStreaming || (showStreamHud && latestPacket)) && (
            <div className="absolute top-4 right-4 z-[400] w-[420px] max-w-[calc(100vw-2rem)]">
              <LiveStreamHud
                isStreaming={isStreaming}
                packet={latestPacket}
                lockedGps={lockedGps}
                packetCount={streamPacketCount}
                onStart={handleStartStream}
                onStop={handleStopStream}
                onClose={() => setShowStreamHud(false)}
              />
            </div>
          )}

          {/* Firebase Error Banner */}
          {firebaseError && (
            <div className="absolute top-4 left-1/2 z-[700] -translate-x-1/2 max-w-[480px] rounded-xl border border-destructive/50 bg-background/95 px-4 py-2.5 text-xs font-medium text-destructive shadow-2xl backdrop-blur-md">
              <div className="flex items-start gap-2">
                <span className="shrink-0 font-bold text-destructive">⚠ Firebase Error:</span>
                <span className="flex-1 leading-relaxed">{firebaseError}</span>
                <button
                  onClick={() => setFirebaseError(null)}
                  className="shrink-0 text-muted-foreground hover:text-foreground ml-1"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Prompt banner when Detect Mode is active */}
          {isDetectingWater && (
            <div className="absolute top-4 left-1/2 z-[700] -translate-x-1/2 rounded-full border border-cyan-400/50 bg-background/95 px-4 py-2 text-xs font-semibold text-cyan-400 shadow-2xl backdrop-blur-md animate-pulse">
              Click directly over any real lake or water body on the map to extract its boundary.
            </div>
          )}

          {/* Right Detail Panel (Conditional) */}
          <DetailPanel
            lake={selectedLake}
            selectedGrid={selectedGrid}
            onBackToLake={() => setSelectedGrid(null)}
            onClose={() => handleSelectLake(null)}
            onStartEditBoundary={() => {
              if (selectedLake && !selectedLake.boundaryLocked) {
                setIsEditingBoundary(true);
              }
            }}
            onOpenClearModal={() => setClearModalLake(selectedLake)}
          />
        </main>
      </div>

      {/* Live In-Situ Telemetry Modal */}
      <LiveTelemetryModal
        packet={latestPacket}
        isOpen={isTelemetryModalOpen}
        onClose={() => setIsTelemetryModalOpen(false)}
        onApplyManualJson={handleApplyManualJson}
      />

      {/* Raspberry Pi Connection Settings Modal */}
      <PiSettingsModal
        isOpen={isPiSettingsOpen}
        onClose={() => setIsPiSettingsOpen(false)}
      />

      {/* Live Robot Camera Video Feed Panel */}
      <LiveVideoPanel
        isOpen={isVideoOpen}
        onClose={() => setIsVideoOpen(false)}
        telemetry={latestPacket}
        isStreaming={isStreaming}
        onOpenPiSettings={() => setIsPiSettingsOpen(true)}
      />

      {/* Basin & Lake Reclamation Analytics Modal */}
      <AnalyticsModal
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
        lakes={lakes}
        onSelectLake={handleSelectLake}
      />

      {/* Threats & Anomaly Surveillance Modal */}
      <ThreatsModal
        isOpen={isThreatsOpen}
        onClose={() => setIsThreatsOpen(false)}
        lakes={lakes}
        onNavigateToLake={handleSelectLake}
      />

      {/* Destructive Clear Lake Confirmation Modal */}
      <ClearLakeModal
        lake={clearModalLake}
        isOpen={!!clearModalLake}
        onClose={() => setClearModalLake(null)}
        onConfirm={handleClearLake}
      />
    </div>
  );
}
