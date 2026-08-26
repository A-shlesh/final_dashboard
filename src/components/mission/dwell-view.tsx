import { cn } from "@/lib/utils";
import { Activity, Clock, Droplets } from "lucide-react";

const SENSOR_LABELS: Record<string, string> = {
  ph: "pH",
  tds: "TDS (ppm)",
  turb: "Turbidity (NTU)",
  wtemp: "Water Temp (°C)",
  atemp: "Air Temp (°C)",
  hum: "Humidity (%)",
};

export function DwellView({
  countdown,
  totalSeconds,
  samples,
  waypointIndex,
}: {
  countdown: number;
  totalSeconds: number;
  samples: Record<string, number>[];
  waypointIndex: number;
}) {
  const progress = ((totalSeconds - countdown) / totalSeconds) * 100;

  // Compute averages
  const avg: Record<string, number> = {};
  if (samples.length > 0) {
    const keys = Object.keys(samples[0]!);
    for (const key of keys) {
      const vals = samples.map((s) => s[key]).filter((v) => typeof v === "number") as number[];
      if (vals.length > 0) avg[key] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
  }

  return (
    <div className="border-b border-cyan-500/30 bg-cyan-500/5 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="size-4 text-cyan-400 animate-pulse" />
        <div>
          <div className="font-display text-xs font-bold text-cyan-400">
            Collecting samples at Waypoint {waypointIndex + 1}
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
            <Clock className="size-3" />
            {countdown}s remaining · {samples.length} samples
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 w-full bg-secondary/50 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-cyan-500 transition-[width] duration-1000 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Live sensor readings */}
      <div className="space-y-1.5">
        {Object.entries(avg).map(([key, val]) => (
          <div key={key} className="flex items-center justify-between border border-cyan-500/10 bg-secondary/20 px-2 py-1">
            <span className="font-mono text-[9px] uppercase text-muted-foreground">
              {SENSOR_LABELS[key] ?? key}
            </span>
            <span className="font-mono text-xs font-bold text-cyan-400">
              {val.toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {samples.length === 0 && (
        <div className="text-center font-mono text-[10px] text-muted-foreground/60">
          Waiting for first sample...
        </div>
      )}
    </div>
  );
}
