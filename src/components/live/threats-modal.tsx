import { useState } from "react";
import { AlertTriangle, AlertCircle, Clock, MapPin, Navigation, ShieldAlert, X, Filter } from "lucide-react";
import { ANOMALIES, TIER_COLOR, type LakeEntity, type Anomaly } from "@/lib/water-data";
import { useKeyboardArrowNav } from "@/lib/keyboard-nav";

export function ThreatsModal({
  isOpen,
  onClose,
  lakes,
  onNavigateToLake,
}: {
  isOpen: boolean;
  onClose: () => void;
  lakes: LakeEntity[];
  onNavigateToLake: (lake: LakeEntity, gridCode?: string) => void;
}) {
  const containerRef = useKeyboardArrowNav<HTMLDivElement>(isOpen, onClose);
  const [filterSev, setFilterSev] = useState<"ALL" | "CRITICAL" | "HIGH" | "MEDIUM">("ALL");

  if (!isOpen) return null;

  // Build live threat entries from registered lakes and anomalies dataset
  const threatsList: {
    id: string;
    lake: LakeEntity;
    msg: string;
    sev: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    hoursAgo: number;
    sensorLabel?: string;
    value?: string;
    threshold?: string;
  }[] = [];

  // 1. Existing lake anomalies
  ANOMALIES.forEach((a, idx) => {
    const matchedLake = lakes.find((l) => l.id === a.lakeId);
    if (matchedLake) {
      threatsList.push({
        id: `anomaly-${idx}`,
        lake: matchedLake,
        msg: a.msg,
        sev: a.sev === "critical" ? "CRITICAL" : a.sev === "stressed" ? "HIGH" : "MEDIUM",
        hoursAgo: a.hoursAgo,
        sensorLabel: a.sev === "critical" ? "Turbidity & Sewage Breach" : "Water Quality Notice",
        value: a.sev === "critical" ? "32.4 NTU" : "pH 6.12",
        threshold: a.sev === "critical" ? "Max 15.0 NTU" : "Min 6.50",
      });
    }
  });

  // 2. Scan active lake grid cells for live sensor threshold breaches
  lakes.forEach((lake) => {
    if (lake.grids) {
      lake.grids.forEach((grid) => {
        if (grid.turbidity > 25) {
          threatsList.push({
            id: `grid-turb-${grid.id}`,
            lake,
            msg: `Elevated turbidity anomaly detected in sector ${grid.code}`,
            sev: "CRITICAL",
            hoursAgo: 1,
            sensorLabel: "Turbidity",
            value: `${grid.turbidity} NTU`,
            threshold: "20.0 NTU",
          });
        }
        if (grid.ph < 6.4 || grid.ph > 8.6) {
          threatsList.push({
            id: `grid-ph-${grid.id}`,
            lake,
            msg: `Chemical pH imbalance in sector ${grid.code}`,
            sev: grid.ph < 6.0 ? "CRITICAL" : "HIGH",
            hoursAgo: 2,
            sensorLabel: "pH Level",
            value: `pH ${grid.ph}`,
            threshold: "6.5 - 8.5",
          });
        }
        if (grid.tds > 500) {
          threatsList.push({
            id: `grid-tds-${grid.id}`,
            lake,
            msg: `High dissolved solids concentration in sector ${grid.code}`,
            sev: "MEDIUM",
            hoursAgo: 3,
            sensorLabel: "TDS Contamination",
            value: `${grid.tds} ppm`,
            threshold: "450 ppm",
          });
        }
      });
    }
  });

  const filtered = filterSev === "ALL" ? threatsList : threatsList.filter((t) => t.sev === filterSev);

  const criticalCount = threatsList.filter((t) => t.sev === "CRITICAL").length;
  const highCount = threatsList.filter((t) => t.sev === "HIGH").length;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        ref={containerRef}
        className="w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden rounded-2xl border border-destructive/40 bg-background/95 p-6 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <ShieldAlert className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold text-foreground">
                  Threat & Anomaly Detection Feed
                </h3>
                {criticalCount > 0 && (
                  <span className="rounded bg-destructive px-1.5 py-0.2 text-[9px] font-bold text-destructive-foreground">
                    {criticalCount} Critical
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Automated Water Contamination & Threshold Breach Surveillance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Close (Esc)"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Severity Filter Tabs */}
        <div className="mt-3 flex items-center justify-between border-b border-border/40 pb-2.5">
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: "ALL", label: `All Alerts (${threatsList.length})` },
                { id: "CRITICAL", label: `Critical (${criticalCount})` },
                { id: "HIGH", label: `Warnings (${highCount})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterSev(tab.id as any)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                  filterSev === tab.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="text-[10px] font-mono text-muted-foreground">
            Live Stream Feed
          </span>
        </div>

        {/* Threat Items List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              <div className="size-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-2">
                <AlertCircle className="size-4" />
              </div>
              No active threshold breaches or environmental anomalies detected in this category.
            </div>
          ) : (
            filtered.map((t) => (
              <div
                key={t.id}
                className={`group flex items-start justify-between gap-3 rounded-xl border p-3 transition-all ${
                  t.sev === "CRITICAL"
                    ? "border-destructive/40 bg-destructive/5 hover:border-destructive/80"
                    : t.sev === "HIGH"
                    ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500/80"
                    : "border-border/60 bg-secondary/20 hover:border-border"
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div
                    className={`mt-0.5 size-2 rounded-full shrink-0 ${
                      t.sev === "CRITICAL"
                        ? "bg-red-500 animate-pulse"
                        : t.sev === "HIGH"
                        ? "bg-amber-400"
                        : "bg-cyan-400"
                    }`}
                  />

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-foreground truncate">{t.lake.name}</span>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase tracking-wider ${
                          t.sev === "CRITICAL"
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : t.sev === "HIGH"
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                        }`}
                      >
                        {t.sev}
                      </span>
                    </div>

                    <div className="mt-1 text-xs text-muted-foreground leading-snug">
                      {t.msg}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] font-mono text-muted-foreground">
                      {t.value && (
                        <div className="text-foreground">
                          Recorded: <span className="font-bold text-destructive">{t.value}</span>
                          <span className="text-muted-foreground ml-1">(Limit: {t.threshold})</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Clock className="size-3" />
                        <span>{t.hoursAgo}h ago</span>
                      </div>
                      <div>{t.lake.zone} Zone</div>
                    </div>
                  </div>
                </div>

                {/* 1-Click Locate Button */}
                <button
                  type="button"
                  onClick={() => {
                    onNavigateToLake(t.lake);
                    onClose();
                  }}
                  className="flex items-center gap-1 rounded-lg border border-border/80 bg-background/80 px-2.5 py-1.5 text-xs font-semibold text-primary shadow-sm hover:bg-primary hover:text-primary-foreground transition-all shrink-0 ml-1"
                  title={`Fly to ${t.lake.name}`}
                >
                  <Navigation className="size-3" />
                  <span>Locate Hotspot</span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-border/60 pt-3">
          <div className="text-[10px] text-muted-foreground">
            Monitoring {lakes.length} registered lake basins across Bengaluru
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
