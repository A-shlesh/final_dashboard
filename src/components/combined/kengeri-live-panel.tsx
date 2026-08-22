import {
  type SensorReading,
  getSensorStatus,
  getTrendSymbol,
  SENSOR_THRESHOLDS,
} from "@/lib/kengeri-simulation";
import { getWqiCategory } from "@/lib/water-analytics";
import { cn } from "@/lib/utils";
import { Activity, Compass, Cpu, Flame, Navigation, Radio, Wind, Droplets } from "lucide-react";

const SENSOR_ICONS: Record<string, React.ElementType> = {
  ph: Droplets,
  turbidity: Activity,
  tds: Cpu,
  watertemp: Flame,
  ambitemp: Wind,
  humidity: Droplets,
  gasCO: Radio,
  gasCH4: Flame,
};

export function KengeriLivePanel({
  reading,
  prevReading,
  overallWqi,
  totalReadings,
  maxReadings,
  hotspotsFound,
  coveragePct,
  alertCount,
}: {
  reading: SensorReading;
  prevReading?: SensorReading | undefined;
  overallWqi: number;
  totalReadings: number;
  maxReadings: number;
  hotspotsFound: number;
  coveragePct: number;
  alertCount: number;
}) {
  const wqiCat = getWqiCategory(overallWqi);
  const sensorKeys = ["ph", "turbidity", "tds", "watertemp", "ambitemp", "humidity", "gasCO", "gasCH4"] as const;

  return (
    <div className="space-y-3">
      {/* Top Telemetry KPI Ribbon */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <KpiBox label="Telemetry Points" val={`${totalReadings} / ${maxReadings}`} sub="Kengeri Lake Survey" tone="var(--data)" />
        <KpiBox label="Area Scanned" val={`${coveragePct}%`} sub="Spatial Grid" tone="var(--signal)" />
        <KpiBox label="Hotspots Flagged" val={String(hotspotsFound)} sub="Exceeding Limits" tone={hotspotsFound > 0 ? "var(--critical)" : "var(--signal)"} />
        <KpiBox label="Lake WQI Score" val={overallWqi.toFixed(0)} sub={wqiCat.label} tone={wqiCat.color} />
        <KpiBox label="Critical Alerts" val={String(alertCount)} sub="Action Required" tone={alertCount > 0 ? "var(--critical)" : "var(--signal)"} />
        <KpiBox label="Robot Ground Speed" val={`${reading.speed} m/s`} sub="Boustrophedon Sweep" tone="var(--foreground)" />
        <KpiBox label="GPS Heading" val={`${reading.heading}°`} sub={`${reading.satellites} Sats Locked`} tone="var(--data)" />
      </div>

      {/* 8-Channel Hardware Sensor Cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {sensorKeys.map((key) => {
          const val = reading[key] as number;
          const prevVal = prevReading ? (prevReading[key] as number) : undefined;
          const status = getSensorStatus(key, val);
          const trend = getTrendSymbol(val, prevVal);
          const meta = SENSOR_THRESHOLDS[key]!;
          const Icon = SENSOR_ICONS[key] || Activity;

          const statusColor =
            status === "critical"
              ? "border-red-500/60 bg-red-500/10 text-red-400"
              : status === "moderate"
                ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                : "border-panel-border bg-secondary/40 text-foreground";

          const valueTone =
            status === "critical"
              ? "text-red-400 text-glow"
              : status === "moderate"
                ? "text-amber-400"
                : "text-signal";

          return (
            <div
              key={key}
              className={cn(
                "relative flex flex-col justify-between overflow-hidden rounded-sm border p-2.5 transition-all",
                statusColor
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Icon className="size-3" />
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    {meta.label}
                  </span>
                </div>
                <span className="font-mono text-xs font-bold" style={{ color: trend.color }}>
                  {trend.sym}
                </span>
              </div>

              <div className="my-1">
                <div className={cn("font-mono text-xl font-bold tabular-nums", valueTone)}>
                  {typeof val === "number" ? val.toFixed(meta.unit === "pH" ? 2 : meta.unit === "°C" || meta.unit === "NTU" ? 1 : 0) : val}
                  <span className="ml-1 font-mono text-[10px] font-normal text-muted-foreground">
                    {meta.unit}
                  </span>
                </div>
              </div>

              <div className="border-t border-panel-border/60 pt-1">
                <div className="truncate font-mono text-[8px] text-muted-foreground">
                  HW: {meta.sensorHardware}
                </div>
                <div className="flex justify-between font-mono text-[8px] text-muted-foreground/80">
                  <span>LIM: {meta.high ? `≤${meta.high}` : `≥${meta.low}`}</span>
                  <span className={cn("uppercase font-semibold", status === "critical" ? "text-red-400" : status === "moderate" ? "text-amber-400" : "text-emerald-400")}>
                    {status}
                  </span>
                </div>
              </div>

              {/* Status accent bottom line */}
              <div
                className={cn(
                  "absolute bottom-0 left-0 right-0 h-[2px]",
                  status === "critical" ? "bg-red-500" : status === "moderate" ? "bg-amber-500" : "bg-emerald-500"
                )}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KpiBox({ label, val, sub, tone }: { label: string; val: string; sub: string; tone: string }) {
  return (
    <div className="border border-panel-border bg-panel/80 p-2 text-center">
      <div className="hud-label text-[9px] uppercase">{label}</div>
      <div className="font-mono text-lg font-bold tabular-nums" style={{ color: tone }}>
        {val}
      </div>
      <div className="truncate font-mono text-[8.5px] text-muted-foreground">{sub}</div>
    </div>
  );
}
