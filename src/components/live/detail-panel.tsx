import {
  ArrowLeft,
  Check,
  Compass,
  Copy,
  Droplets,
  Edit3,
  Flame,
  Grid3X3,
  MapPin,
  Radio,
  Thermometer,
  Trash2,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import {
  computeLakeAggregates,
  tierColor,
  tierOf,
  type GridSensorData,
  type LakeEntity,
  type NetworkStatus,
} from "@/lib/water-data";

export function DetailPanel({
  lake,
  selectedGrid,
  onBackToLake,
  onClose,
  onStartEditBoundary,
  onOpenClearModal,
}: {
  lake: LakeEntity | null;
  selectedGrid: GridSensorData | null;
  onBackToLake: () => void;
  onClose: () => void;
  onStartEditBoundary: () => void;
  onOpenClearModal: () => void;
}) {
  if (!lake) return null;

  const aggregates = computeLakeAggregates(lake.grids ?? [], [lake.lat, lake.lng]);

  return (
    <aside className="absolute right-4 top-4 z-[600] flex max-h-[calc(100vh-2rem)] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-border/80 bg-background/95 shadow-2xl backdrop-blur-xl animate-in slide-in-from-right-4 duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border/80 px-4 py-3 bg-secondary/30">
        <div className="flex items-center gap-2 min-w-0">
          {selectedGrid ? (
            <button
              onClick={onBackToLake}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              title="Back to lake overview"
            >
              <ArrowLeft className="size-3.5" />
              <span>{lake.name}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="size-2 rounded-full bg-primary" />
              <span className="truncate text-xs font-bold uppercase tracking-wider text-foreground">
                Water Body Overview
              </span>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Close panel"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Panel Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {selectedGrid ? (
          /* ================= GRID SENSOR VIEW ================= */
          <GridDetailsView grid={selectedGrid} lakeName={lake.name} />
        ) : (
          /* ================= LAKE OVERVIEW VIEW ================= */
          <LakeOverviewView
            lake={lake}
            aggregates={aggregates}
            onStartEditBoundary={onStartEditBoundary}
            onOpenClearModal={onOpenClearModal}
          />
        )}
      </div>
    </aside>
  );
}

/* =========================================================================
   LAKE OVERVIEW VIEW (Calculated dynamically from all grids)
   ========================================================================= */
function LakeOverviewView({
  lake,
  aggregates,
  onStartEditBoundary,
  onOpenClearModal,
}: {
  lake: LakeEntity;
  aggregates: ReturnType<typeof computeLakeAggregates>;
  onStartEditBoundary: () => void;
  onOpenClearModal: () => void;
}) {
  const healthTier = tierOf(aggregates.waterHealthIndex);
  const healthColor = tierColor(healthTier);

  const [copied, setCopied] = useState(false);

  function handleCopyCoords() {
    if (!lake.boundary) return;
    const jsonStr = JSON.stringify(lake.boundary, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="space-y-4">
      {/* Title & Metadata */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {lake.zone} Basin · {lake.areaHa} Hectares
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">{lake.name}</h2>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          Fleet Unit: <span className="font-mono font-medium text-foreground">{lake.robotUnit}</span>
        </div>
      </div>

      {/* Water Health Index & Network Status Card */}
      <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-border/80 bg-secondary/30 p-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Water Health Index
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold" style={{ color: healthColor }}>
              {aggregates.waterHealthIndex}
            </span>
            <span className="text-[11px] text-muted-foreground">/100</span>
          </div>
          <div
            className="mt-0.5 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
            style={{ backgroundColor: healthColor }}
          >
            {healthTier}
          </div>
        </div>

        <div className="border-l border-border/60 pl-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Network Status
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <StatusDot status={aggregates.networkStatus} />
            <span className="text-sm font-bold text-foreground">{aggregates.networkStatus}</span>
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            {aggregates.totalGrids} Uniform Grids
          </div>
        </div>
      </div>

      {/* Aggregated Sensor Metrics derived from all grids */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
          <span>AGGREGATE LAKE TELEMETRY</span>
          <span className="text-[9px] font-normal lowercase tracking-normal">avg from {aggregates.totalGrids} grids</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <MetricCard
            icon={Flame}
            label="MQ-135 Gas"
            value={`${aggregates.avgMq135}`}
            unit="ppm"
            status={aggregates.avgMq135 < 45 ? "normal" : "warning"}
          />
          <MetricCard
            icon={Droplets}
            label="Turbidity"
            value={`${aggregates.avgTurbidity}`}
            unit="NTU"
            status={aggregates.avgTurbidity < 20 ? "normal" : aggregates.avgTurbidity < 50 ? "warning" : "critical"}
          />
          <MetricCard
            icon={Zap}
            label="pH Level"
            value={`${aggregates.avgPh}`}
            unit=""
            status={aggregates.avgPh >= 6.5 && aggregates.avgPh <= 8.5 ? "normal" : "warning"}
          />
          <MetricCard
            icon={Wind}
            label="TDS"
            value={`${aggregates.avgTds}`}
            unit="ppm"
            status={aggregates.avgTds < 350 ? "normal" : "warning"}
          />
          <MetricCard
            icon={Thermometer}
            label="Water Temp"
            value={`${aggregates.avgTemp}`}
            unit="°C"
            status="normal"
          />
          <MetricCard
            icon={Compass}
            label="Sweep Bearing"
            value={`${aggregates.circularCompass}°`}
            unit="mean"
            status="normal"
          />
        </div>
      </div>

      {/* Grid Survey Progress */}
      <div className="rounded-lg border border-border/80 bg-secondary/30 p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground">Reclamation Sweep</span>
          <span className="font-mono text-xs font-bold text-emerald-500">
            {aggregates.reclaimedPct}% Reclaimed
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${aggregates.reclaimedPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-emerald-500 inline-block" /> {aggregates.cleanedGrids} Cleaned</span>
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-amber-500 inline-block" /> {aggregates.activeGrids} Active</span>
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-muted-foreground/50 inline-block" /> {aggregates.untouchedGrids} Untouched</span>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-2 flex flex-col gap-2 border-t border-border/60">
        {/* Copy Coordinates Button */}
        <button
          onClick={handleCopyCoords}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-secondary/50 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
          title="Copy [ [lng, lat], ... ] boundary coordinates to clipboard"
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-emerald-500" />
              <span className="text-emerald-500">Copied {lake.boundary?.length ?? 0} Boundary Coordinates!</span>
            </>
          ) : (
            <>
              <Copy className="size-3.5 text-primary" />
              <span>Copy Boundary Coordinates ({lake.boundary?.length ?? 0} pts)</span>
            </>
          )}
        </button>

        <div className="rounded-md bg-secondary/50 py-1.5 text-center text-[10px] font-medium text-muted-foreground">
          Boundary Locked & Surveyed
        </div>

        <button
          onClick={onOpenClearModal}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-destructive/20 bg-destructive/5 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/15"
        >
          <Trash2 className="size-3.5" />
          Delete Lake from Observatory
        </button>
      </div>
    </div>
  );
}

/* =========================================================================
   GRID DETAILS VIEW (8 hardware sensors for specific clicked grid cell)
   ========================================================================= */
function GridDetailsView({
  grid,
  lakeName,
}: {
  grid: GridSensorData;
  lakeName: string;
}) {
  const healthTier = tierOf(grid.waterHealthIndex);
  const healthColor = tierColor(healthTier);

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Grid Identifier Header */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {lakeName} · Sector
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <span>{grid.code}</span>
          <span
            className="rounded px-2 py-0.5 text-[10px] font-semibold capitalize text-white"
            style={{
              backgroundColor:
                grid.state === "cleaned"
                  ? "#10b981"
                  : grid.state === "active"
                    ? "#f59e0b"
                    : "#64748b",
            }}
          >
            {grid.state}
          </span>
        </h2>
        <div className="mt-1 font-mono text-[10.5px] text-muted-foreground">
          GPS: {grid.gps[0].toFixed(5)}, {grid.gps[1].toFixed(5)}
        </div>
      </div>

      {/* Grid Health & Status */}
      <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-border/80 bg-secondary/30 p-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Grid Health Index
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold" style={{ color: healthColor }}>
              {grid.waterHealthIndex}
            </span>
            <span className="text-[11px] text-muted-foreground">/100</span>
          </div>
          <div
            className="mt-0.5 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
            style={{ backgroundColor: healthColor }}
          >
            {healthTier}
          </div>
        </div>

        <div className="border-l border-border/60 pl-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Network Status
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <StatusDot status={grid.networkStatus} />
            <span className="text-sm font-bold text-foreground">{grid.networkStatus}</span>
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            Bearing: <span className="font-mono font-medium text-foreground">{grid.compass}°</span>
          </div>
        </div>
      </div>

      {/* 8 IoT Sensor Readings */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-muted-foreground">
          GRID IOT SENSOR PAYLOAD
        </div>

        <div className="grid grid-cols-2 gap-2">
          <MetricCard
            icon={Flame}
            label="MQ-135 (Gas)"
            value={`${grid.mq135}`}
            unit="ppm"
            status={grid.mq135 < 45 ? "normal" : "warning"}
          />
          <MetricCard
            icon={Droplets}
            label="Turbidity"
            value={`${grid.turbidity}`}
            unit="NTU"
            status={grid.turbidity < 20 ? "normal" : grid.turbidity < 50 ? "warning" : "critical"}
          />
          <MetricCard
            icon={Zap}
            label="pH Probe"
            value={`${grid.ph}`}
            unit=""
            status={grid.ph >= 6.5 && grid.ph <= 8.5 ? "normal" : "warning"}
          />
          <MetricCard
            icon={Wind}
            label="TDS"
            value={`${grid.tds}`}
            unit="ppm"
            status={grid.tds < 350 ? "normal" : "warning"}
          />
          <MetricCard
            icon={Thermometer}
            label="DHT Temp"
            value={`${grid.dhtTemp}`}
            unit="°C"
            status="normal"
          />
          <MetricCard
            icon={Droplets}
            label="Humidity"
            value={`${grid.dhtHumidity}`}
            unit="%"
            status="normal"
          />
          <MetricCard
            icon={Compass}
            label="Compass"
            value={`${grid.compass}°`}
            unit=""
            status="normal"
          />
          <MetricCard
            icon={Radio}
            label="Telemetry"
            value="Online"
            unit="915MHz"
            status="normal"
          />
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  status = "normal",
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  unit: string;
  status?: "normal" | "warning" | "critical";
}) {
  const badgeColor =
    status === "normal"
      ? "text-foreground"
      : status === "warning"
        ? "text-amber-500 font-bold"
        : "text-red-500 font-bold";

  return (
    <div className="rounded-lg border border-border/70 bg-card p-2.5 shadow-sm transition-all hover:border-primary/40">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="text-[10.5px] font-medium truncate">{label}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`text-base font-bold tracking-tight ${badgeColor}`}>{value}</span>
        {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: NetworkStatus }) {
  const color =
    status === "Healthy" ? "bg-emerald-500" : status === "Stressed" ? "bg-amber-500" : "bg-red-500";
  return <span className={`size-2 rounded-full ${color}`} />;
}
