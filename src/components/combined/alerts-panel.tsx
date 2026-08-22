import { useMemo, useState } from "react";
import { detectAnomalies, type AnomalyAlert, SENSOR_DISPLAY_NAMES } from "@/lib/water-analytics";
import { type SensorReading } from "@/lib/kengeri-simulation";
import { AlertCircle, AlertTriangle, Filter, Search, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function AlertsPanel({
  readings,
  onSelectAlertGps,
}: {
  readings: SensorReading[];
  onSelectAlertGps?: (lat: number, lon: number) => void;
}) {
  const [filterSeverity, setFilterSeverity] = useState<"ALL" | "CRITICAL" | "WARNING">("ALL");
  const [selectedSensor, setSelectedSensor] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const allAlerts = useMemo(() => detectAnomalies(readings), [readings]);

  const criticalCount = useMemo(() => allAlerts.filter((a) => a.severity === "CRITICAL").length, [allAlerts]);
  const warningCount = useMemo(() => allAlerts.filter((a) => a.severity === "WARNING").length, [allAlerts]);
  const alertRate = useMemo(() => {
    return readings.length > 0 ? ((allAlerts.length / readings.length) * 100).toFixed(1) : "0";
  }, [allAlerts.length, readings.length]);

  // Sensor alert breakdown
  const sensorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allAlerts.forEach((a) => {
      counts[a.sensorKey] = (counts[a.sensorKey] || 0) + 1;
    });
    return counts;
  }, [allAlerts]);

  // Filtered alerts
  const filtered = useMemo(() => {
    return allAlerts.filter((a) => {
      if (filterSeverity !== "ALL" && a.severity !== filterSeverity) return false;
      if (selectedSensor !== "ALL" && a.sensorKey !== selectedSensor) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          a.sensorLabel.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q) ||
          a.direction.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allAlerts, filterSeverity, selectedSensor, searchQuery]);

  return (
    <div className="border border-panel-border bg-panel p-3">
      {/* Header & KPI Summary */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-panel-border/60 pb-2">
        <div>
          <div className="hud-label">Real-Time Threat & Anomaly Feed</div>
          <div className="font-mono text-[9px] text-muted-foreground">
            Multi-sensor threshold breaches flagged per CPCB & WHO environmental standards
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="border border-red-500/40 bg-red-500/10 px-2 py-0.5 font-mono text-[9.5px] text-red-400">
            CRITICAL: <b>{criticalCount}</b>
          </div>
          <div className="border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[9.5px] text-amber-400">
            WARNING: <b>{warningCount}</b>
          </div>
          <div className="border border-panel-border bg-secondary/50 px-2 py-0.5 font-mono text-[9.5px] text-data">
            ALERT RATE: <b>{alertRate}%</b>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 border border-panel-border bg-secondary/40 p-0.5">
          {(["ALL", "CRITICAL", "WARNING"] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={cn(
                "px-2 py-0.5 font-mono text-[8.5px] uppercase transition-colors",
                filterSeverity === sev
                  ? "bg-foreground text-background font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {sev}
            </button>
          ))}
        </div>

        {/* Sensor Breakdown Quick Pills */}
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => setSelectedSensor("ALL")}
            className={cn(
              "border px-1.5 py-0.5 font-mono text-[8px]",
              selectedSensor === "ALL"
                ? "border-signal bg-signal/20 text-signal"
                : "border-panel-border bg-secondary/20 text-muted-foreground hover:text-foreground"
            )}
          >
            All Sensors ({allAlerts.length})
          </button>
          {Object.entries(sensorCounts).map(([key, count]) => (
            <button
              key={key}
              onClick={() => setSelectedSensor(key)}
              className={cn(
                "border px-1.5 py-0.5 font-mono text-[8px]",
                selectedSensor === key
                  ? "border-amber-400 bg-amber-500/20 text-amber-300"
                  : "border-panel-border bg-secondary/20 text-muted-foreground hover:text-foreground"
              )}
            >
              {SENSOR_DISPLAY_NAMES[key] || key}: {count}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="ml-auto flex items-center gap-1 border border-panel-border bg-secondary/30 px-2 py-0.5">
          <Search className="size-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-24 bg-transparent font-mono text-[9px] text-foreground focus:outline-none sm:w-36"
          />
        </div>
      </div>

      {/* Alert Items List */}
      <div className="max-h-[380px] space-y-1.5 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="py-8 text-center font-mono text-[10px] text-emerald-400">
            NO THREAT OR ANOMALY BREACHES DETECTED
          </div>
        ) : (
          filtered.map((a) => (
            <div
              key={a.id}
              onClick={() => onSelectAlertGps?.(a.latitude, a.longitude)}
              className={cn(
                "group flex cursor-pointer items-center justify-between border p-2 transition-all hover:border-signal/80",
                a.severity === "CRITICAL"
                  ? "border-red-500/40 bg-red-500/10 text-red-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-200"
              )}
            >
              <div className="flex items-center gap-2">
                {a.severity === "CRITICAL" ? (
                  <AlertCircle className="size-3.5 shrink-0 text-red-400" />
                ) : (
                  <AlertTriangle className="size-3.5 shrink-0 text-amber-400" />
                )}
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[9.5px] font-bold text-foreground">
                      [{a.severity}] {a.sensorLabel}
                    </span>
                    <span className="font-mono text-[8px] text-muted-foreground">
                      Point #{a.readingIndex}
                    </span>
                  </div>
                  <div className="font-mono text-[8.5px] text-muted-foreground">
                    Value <b className="text-foreground">{a.value} {a.unit}</b> is {a.direction} threshold ({a.threshold} {a.unit})
                  </div>
                </div>
              </div>

              <div className="text-right font-mono text-[8.5px] text-muted-foreground">
                <div>{new Date(a.timestamp).toLocaleTimeString()}</div>
                <div className="text-data opacity-0 transition-opacity group-hover:opacity-100">
                  {a.latitude.toFixed(5)}, {a.longitude.toFixed(5)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
