import { useEffect, useState } from "react";
import { getWsEndpoint } from "@/hooks/use-live-telemetry";
import { ChevronDown, ChevronRight, Database } from "lucide-react";
import { cn } from "@/lib/utils";

type Mission = {
  id: number;
  created_at: number;
  waypoint_count: number;
  status: string;
};

type WaypointResult = {
  mission_id: number;
  waypoint_index: number;
  lat: number;
  lon: number;
  arrived_at: number;
  sample_count: number;
  avg_sensors: Record<string, number>;
};

export function MissionHistory() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [results, setResults] = useState<WaypointResult[]>([]);
  const [loading, setLoading] = useState(false);

  const httpBase = getWsEndpoint().replace(/^ws/, "http").replace(/\/ws\/?$/, "");

  useEffect(() => {
    setLoading(true);
    fetch(`${httpBase}/api/missions`)
      .then((r) => r.json())
      .then((data) => setMissions(Array.isArray(data) ? data : []))
      .catch(() => setMissions([]))
      .finally(() => setLoading(false));
  }, [httpBase]);

  useEffect(() => {
    if (selectedId === null) { setResults([]); return; }
    fetch(`${httpBase}/api/missions/${selectedId}/waypoints`)
      .then((r) => r.json())
      .then((data) => setResults(Array.isArray(data) ? data : []))
      .catch(() => setResults([]));
  }, [selectedId, httpBase]);

  return (
    <div className="max-h-[300px] overflow-y-auto p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Database className="size-3.5 text-muted-foreground" />
        <span className="hud-label">Mission History</span>
      </div>

      {loading && <div className="text-[10px] text-muted-foreground">Loading...</div>}

      {missions.length === 0 && !loading && (
        <div className="text-[10px] text-muted-foreground/60">No past missions.</div>
      )}

      {missions.map((m) => (
        <div key={m.id}>
          <button
            onClick={() => setSelectedId(selectedId === m.id ? null : m.id)}
            className="flex w-full items-center gap-2 rounded border border-border/60 bg-secondary/10 px-2.5 py-1.5 text-left hover:bg-secondary/30"
          >
            {selectedId === m.id ? <ChevronDown className="size-3 text-muted-foreground" /> : <ChevronRight className="size-3 text-muted-foreground" />}
            <div className="flex-1">
              <div className="font-mono text-[10px] font-bold text-foreground">Mission #{m.id}</div>
              <div className="font-mono text-[9px] text-muted-foreground">
                {m.waypoint_count} waypoints · {m.status}
              </div>
            </div>
            <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold", m.status === "COMPLETE" ? "bg-emerald-500/10 text-emerald-400" : "bg-secondary/50 text-muted-foreground")}>
              {m.status}
            </span>
          </button>

          {selectedId === m.id && results.length > 0 && (
            <div className="mt-1 ml-4 space-y-1 border-l border-border/40 pl-2">
              {results.map((r) => (
                <div key={r.waypoint_index} className="rounded border border-border/40 bg-secondary/10 px-2 py-1.5">
                  <div className="font-mono text-[10px] font-bold text-foreground">
                    WP {r.waypoint_index + 1} · {r.sample_count} samples
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
                    {Object.entries(r.avg_sensors).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="font-mono text-[8px] uppercase text-muted-foreground">{key}</span>
                        <span className="font-mono text-[9px] text-foreground/80">{typeof val === "number" ? val.toFixed(2) : val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
