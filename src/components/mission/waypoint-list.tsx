import { MapPin, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Waypoint = { lat: number; lon: number };
type WaypointStatus = "PENDING" | "ACTIVE" | "DONE";

export function WaypointList({
  waypoints,
  currentIndex,
  state,
}: {
  waypoints: Waypoint[];
  currentIndex: number;
  state: string;
}) {
  if (waypoints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <MapPin className="mb-2 size-8 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">No waypoints placed yet.</p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">Click &quot;Place&quot; then click on the map.</p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1">
      {waypoints.map((wp, i) => {
        const status: WaypointStatus =
          i < currentIndex ? "DONE" :
          i === currentIndex && (state === "RUNNING" || state === "DWELL") ? "ACTIVE" :
          "PENDING";

        return (
          <div
            key={i}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors",
              status === "ACTIVE" ? "border-cyan-500/30 bg-cyan-500/10" :
              status === "DONE" ? "border-emerald-500/20 bg-emerald-500/5" :
              "border-border/60 bg-secondary/10",
            )}
          >
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] font-bold"
              style={{
                borderColor: status === "DONE" ? "#22c55e" : status === "ACTIVE" ? "#00e5ff" : "#4b5563",
                color: status === "DONE" ? "#22c55e" : status === "ACTIVE" ? "#00e5ff" : "#9ca3af",
                backgroundColor: status === "ACTIVE" ? "#00e5ff15" : "transparent",
              }}
            >
              {status === "DONE" ? <CheckCircle2 className="size-3.5" /> :
               status === "ACTIVE" ? <Loader2 className="size-3.5 animate-spin" /> :
               i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[10px] text-muted-foreground">
                WP {i + 1} {status === "ACTIVE" && <span className="text-cyan-400">● ACTIVE</span>}
                {status === "DONE" && <span className="text-emerald-400">✓ DONE</span>}
              </div>
              <div className="font-mono text-[10px] text-foreground/70 truncate">
                {wp.lat.toFixed(6)}, {wp.lon.toFixed(6)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
