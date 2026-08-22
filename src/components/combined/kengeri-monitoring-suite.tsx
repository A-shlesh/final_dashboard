import { useState } from "react";
import { useKengeriSimulation, type PlaybackSpeed } from "@/hooks/use-kengeri-simulation";
import { KengeriLivePanel } from "./kengeri-live-panel";
import { WqiRadialGauge } from "./wqi-radial-gauge";
import { KengeriMapView } from "./kengeri-map-view";
import { CompassHud } from "./compass-hud";
import { CorrelationHeatmap } from "./correlation-heatmap";
import { SensorTimeseriesGrid } from "./sensor-timeseries-grid";
import { RemediationPanel } from "./remediation-panel";
import { AlertsPanel } from "./alerts-panel";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  Compass,
  FastForward,
  Flame,
  Layers,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  TrendingUp,
  Sparkles,
} from "lucide-react";

export type KengeriSubTab = "overview" | "wqi" | "pollution" | "analytics" | "alerts";

export function KengeriMonitoringSuite() {
  const sim = useKengeriSimulation();
  const [activeTab, setActiveTab] = useState<KengeriSubTab>("overview");
  const [mapLayers, setMapLayers] = useState({
    path: true,
    hotspots: true,
    centroid: true,
    grid: false,
  });

  const toggleMapLayer = (layer: "path" | "hotspots" | "centroid" | "grid") => {
    setMapLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  const pointWqis = sim.activeReadings.map((r) => r.wqi);
  const minPointWqi = pointWqis.length ? Math.min(...pointWqis) : 0;
  const maxPointWqi = pointWqis.length ? Math.max(...pointWqis) : 100;
  const avgPointWqi = pointWqis.length ? +(pointWqis.reduce((a, b) => a + b, 0) / pointWqis.length).toFixed(1) : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
      {/* Simulation Playback Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-panel-border bg-panel/90 px-3 py-1.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-foreground">
            <span
              className={cn(
                "size-2 rounded-full",
                sim.isPlaying ? "animate-pulse bg-emerald-400" : "bg-amber-400"
              )}
            />
            {sim.isPlaying ? "STREAMING LIVE" : "SIMULATION PAUSED"}
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={sim.togglePlay}
              className="flex items-center gap-1 border border-panel-border bg-secondary/60 px-2.5 py-1 font-mono text-[9.5px] uppercase transition-colors hover:border-signal hover:text-signal"
            >
              {sim.isPlaying ? <Pause className="size-3 text-amber-400" /> : <Play className="size-3 text-emerald-400" />}
              {sim.isPlaying ? "Pause" : "Play"}
            </button>

            <button
              onClick={sim.stepForward}
              title="Step forward +5 readings"
              className="border border-panel-border bg-secondary/60 p-1 text-muted-foreground transition-colors hover:border-signal hover:text-signal"
            >
              <SkipForward className="size-3" />
            </button>

            <button
              onClick={sim.reset}
              title="Reset simulation to beginning"
              className="border border-panel-border bg-secondary/60 p-1 text-muted-foreground transition-colors hover:border-signal hover:text-signal"
            >
              <RotateCcw className="size-3" />
            </button>
          </div>
        </div>

        {/* Playback Speed & Reading Scrubber */}
        <div className="flex items-center gap-3 font-mono text-[9px]">
          <div className="flex items-center gap-1 text-muted-foreground">
            <span>SPEED:</span>
            {([3000, 1000, 500, 200] as const).map((s) => (
              <button
                key={s}
                onClick={() => sim.setSpeed(s)}
                className={cn(
                  "border px-1.5 py-0.5 transition-colors",
                  sim.speed === s
                    ? "border-signal bg-signal/20 font-bold text-signal"
                    : "border-panel-border bg-secondary/30 text-muted-foreground hover:text-foreground"
                )}
              >
                {s === 3000 ? "3s" : s === 1000 ? "1s" : s === 500 ? "0.5s" : "TURBO"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="range"
              min={10}
              max={sim.totalCount}
              value={sim.pointer}
              onChange={(e) => sim.jumpTo(Number(e.target.value))}
              className="h-1.5 w-28 accent-signal sm:w-44"
            />
            <span className="tabular-nums text-foreground">
              {sim.pointer} / {sim.totalCount}
            </span>
          </div>
        </div>
      </div>

      {/* 8-Channel Hardware Telemetry Ribbon */}
      <KengeriLivePanel
        reading={sim.currentReading}
        prevReading={sim.prevReading}
        overallWqi={sim.overallWqi}
        totalReadings={sim.activeReadings.length}
        maxReadings={sim.totalCount}
        hotspotsFound={sim.hotspotsFound}
        coveragePct={sim.coverage.coveragePct}
        alertCount={sim.anomalies.filter((a) => a.severity === "CRITICAL").length}
      />

      {/* Sub-View Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between border-b border-panel-border bg-panel px-2 py-1">
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: "overview", label: "Live Map & Nav", icon: Compass },
            { id: "wqi", label: "WQI & Remediation", icon: TrendingUp },
            { id: "pollution", label: "Hotspots & Plume", icon: Flame },
            { id: "analytics", label: "Advanced Analytics", icon: Activity },
            { id: "alerts", label: `Threat Feed (${sim.anomalies.length})`, icon: AlertTriangle },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as KengeriSubTab)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
                activeTab === tab.id
                  ? "border border-signal/60 bg-signal/15 text-signal font-semibold"
                  : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
              )}
            >
              <tab.icon className="size-3" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="font-mono text-[9px] text-muted-foreground">
          LAT: <b className="text-foreground">{sim.currentReading.latitude.toFixed(5)}</b> · LON:{" "}
          <b className="text-foreground">{sim.currentReading.longitude.toFixed(5)}</b>
        </div>
      </div>

      {/* Dynamic Sub-View Content */}
      <div className="min-h-0 flex-1 space-y-2">
        {activeTab === "overview" && (
          <div className="grid min-h-0 grid-cols-1 gap-2 xl:grid-cols-[1fr_320px]">
            <div className="flex flex-col gap-2">
              <CompassHud
                heading={sim.currentReading.heading}
                speed={sim.currentReading.speed}
                satellites={sim.currentReading.satellites}
                lat={sim.currentReading.latitude}
                lon={sim.currentReading.longitude}
              />
              <KengeriMapView
                readings={sim.activeReadings}
                currentReading={sim.currentReading}
                centroid={sim.centroid}
                coverage={sim.coverage}
                showPath={mapLayers.path}
                showHotspots={mapLayers.hotspots}
                showCentroid={mapLayers.centroid}
                showCoverageGrid={mapLayers.grid}
                onToggleLayer={toggleMapLayer}
              />
            </div>

            <div className="flex flex-col gap-2">
              <WqiRadialGauge
                score={sim.overallWqi}
                totalPoints={sim.activeReadings.length}
                minPointWqi={minPointWqi}
                maxPointWqi={maxPointWqi}
                avgPointWqi={avgPointWqi}
              />
              <AlertsPanel readings={sim.activeReadings} />
            </div>
          </div>
        )}

        {activeTab === "wqi" && (
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
              <WqiRadialGauge
                score={sim.overallWqi}
                totalPoints={sim.activeReadings.length}
                minPointWqi={minPointWqi}
                maxPointWqi={maxPointWqi}
                avgPointWqi={avgPointWqi}
              />
              <div className="lg:col-span-2">
                <RemediationPanel readings={sim.activeReadings} />
              </div>
            </div>
            <SensorTimeseriesGrid readings={sim.activeReadings} />
          </div>
        )}

        {activeTab === "pollution" && (
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-[1fr_360px]">
            <KengeriMapView
              readings={sim.activeReadings}
              currentReading={sim.currentReading}
              centroid={sim.centroid}
              coverage={sim.coverage}
              showPath={mapLayers.path}
              showHotspots={mapLayers.hotspots}
              showCentroid={mapLayers.centroid}
              showCoverageGrid={mapLayers.grid}
              onToggleLayer={toggleMapLayer}
            />
            <div className="flex flex-col gap-2">
              <CorrelationHeatmap readings={sim.activeReadings} />
              <AlertsPanel readings={sim.activeReadings} />
            </div>
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="space-y-2">
            <CorrelationHeatmap readings={sim.activeReadings} />
            <SensorTimeseriesGrid readings={sim.activeReadings} />
          </div>
        )}

        {activeTab === "alerts" && (
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
            <AlertsPanel readings={sim.activeReadings} />
            <KengeriMapView
              readings={sim.activeReadings}
              currentReading={sim.currentReading}
              centroid={sim.centroid}
              coverage={sim.coverage}
              showPath={mapLayers.path}
              showHotspots={mapLayers.hotspots}
              showCentroid={mapLayers.centroid}
              showCoverageGrid={mapLayers.grid}
              onToggleLayer={toggleMapLayer}
            />
          </div>
        )}
      </div>
    </div>
  );
}
