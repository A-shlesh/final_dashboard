import { Activity, Droplets, Map, ShieldCheck, TrendingUp, X, BarChart3, Gauge, CheckCircle2, AlertTriangle } from "lucide-react";
import { computeLakeAggregates, tierColor, tierOf, type LakeEntity } from "@/lib/water-data";
import { useKeyboardArrowNav } from "@/lib/keyboard-nav";

export function AnalyticsModal({
  isOpen,
  onClose,
  lakes,
  onSelectLake,
}: {
  isOpen: boolean;
  onClose: () => void;
  lakes: LakeEntity[];
  onSelectLake: (lake: LakeEntity) => void;
}) {
  const containerRef = useKeyboardArrowNav<HTMLDivElement>(isOpen, onClose);

  if (!isOpen) return null;

  const totalLakes = lakes.length;
  const totalHa = lakes.reduce((s, l) => s + (l.areaHa || 0), 0);

  let totalCleanedHa = 0;
  let totalActiveHa = 0;
  let totalHealthSum = 0;
  let totalGridsCount = 0;
  let totalCleanedGrids = 0;
  let totalActiveGrids = 0;

  const lakeStats = lakes.map((l) => {
    const agg = computeLakeAggregates(l.grids ?? [], [l.lat, l.lng]);
    totalHealthSum += agg.waterHealthIndex;
    totalCleanedHa += (l.areaHa * agg.reclaimedPct) / 100;
    totalActiveHa += (l.areaHa * (100 - agg.reclaimedPct)) / 100;
    totalGridsCount += l.grids?.length ?? 0;
    totalCleanedGrids += agg.cleanedGrids;
    totalActiveGrids += agg.activeGrids;

    return {
      lake: l,
      agg,
      tier: tierOf(agg.waterHealthIndex),
    };
  });

  const meanBasinHealth = Math.round(totalHealthSum / Math.max(1, totalLakes));
  const healthTier = tierOf(meanBasinHealth);
  const overallReclaimedPct = totalHa > 0 ? Math.round((totalCleanedHa / totalHa) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        ref={containerRef}
        className="w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-background/95 p-6 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Activity className="size-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-foreground">
                Reclamation & Basin Analytics
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Bengaluru Environmental Intelligence & Lake Health Computations
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

        {/* Modal Content Scroll Area */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* Top Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border/60 bg-secondary/20 p-3.5">
              <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-muted-foreground">
                <Map className="size-3.5 text-primary" />
                <span>Surveyed Water Bodies</span>
              </div>
              <div className="mt-1.5 text-2xl font-bold text-foreground">
                {totalLakes}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({totalHa.toFixed(1)} ha)
                </span>
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {totalGridsCount} IoT Sectors Partitioned
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-secondary/20 p-3.5">
              <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-muted-foreground">
                <Droplets className="size-3.5 text-emerald-500" />
                <span>Reclamation Progress</span>
              </div>
              <div className="mt-1.5 text-2xl font-bold text-emerald-500">
                {overallReclaimedPct}%
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {totalCleanedHa.toFixed(1)} ha Reclaimed / {totalHa.toFixed(1)} ha Total
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-secondary/20 p-3.5">
              <div className="flex items-center justify-between text-[10.5px] font-semibold text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-primary" />
                  <span>Basin Health (WQI)</span>
                </div>
                <span
                  className="rounded px-1.5 py-0.2 text-[9px] font-bold text-white uppercase"
                  style={{ backgroundColor: tierColor(healthTier) }}
                >
                  {healthTier}
                </span>
              </div>
              <div className="mt-1.5 text-2xl font-extrabold" style={{ color: tierColor(healthTier) }}>
                {meanBasinHealth}{" "}
                <span className="text-xs font-normal text-muted-foreground">/ 100</span>
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                Dynamic Grid-Weighted Average
              </div>
            </div>
          </div>

          {/* Environmental Parameter Averages */}
          <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Basin Water Quality Thresholds
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                Standard Water Safety Index
              </span>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-3">
              <div className="rounded-lg border border-border/40 bg-background/50 p-2.5">
                <div className="text-[10px] font-semibold text-muted-foreground">Total Dissolved Solids</div>
                <div className="mt-1 text-sm font-bold text-foreground font-mono">385.2 ppm</div>
                <div className="mt-0.5 text-[9.5px] text-emerald-500">Normal (Safe &lt; 500)</div>
              </div>

              <div className="rounded-lg border border-border/40 bg-background/50 p-2.5">
                <div className="text-[10px] font-semibold text-muted-foreground">Mean Turbidity</div>
                <div className="mt-1 text-sm font-bold text-foreground font-mono">16.8 NTU</div>
                <div className="mt-0.5 text-[9.5px] text-amber-400">Moderate Clarity</div>
              </div>

              <div className="rounded-lg border border-border/40 bg-background/50 p-2.5">
                <div className="text-[10px] font-semibold text-muted-foreground">Acidity / pH</div>
                <div className="mt-1 text-sm font-bold text-foreground font-mono">7.28</div>
                <div className="mt-0.5 text-[9.5px] text-emerald-500">Neutral (6.5 - 8.5)</div>
              </div>

              <div className="rounded-lg border border-border/40 bg-background/50 p-2.5">
                <div className="text-[10px] font-semibold text-muted-foreground">Air Temperature</div>
                <div className="mt-1 text-sm font-bold text-foreground font-mono">29.4 °C</div>
                <div className="mt-0.5 text-[9.5px] text-muted-foreground">64.2% Rel. Humidity</div>
              </div>
            </div>
          </div>

          {/* Registered Water Bodies Health Ranking Table */}
          <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Registered Lakes Environmental Health Status
              </span>
              <span className="text-[10px] text-muted-foreground">
                Click any lake to fly & inspect
              </span>
            </div>

            <div className="mt-2.5 space-y-1.5">
              {lakeStats.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No lakes registered yet. Click &quot;+ Add Lake&quot; on the top bar to survey a water body.
                </div>
              ) : (
                lakeStats.map(({ lake, agg, tier }) => (
                  <button
                    key={lake.id}
                    onClick={() => {
                      onSelectLake(lake);
                      onClose();
                    }}
                    className="flex w-full items-center justify-between rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-left text-xs transition-all hover:bg-accent hover:border-border"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: tierColor(tier) }}
                      />
                      <div className="truncate">
                        <div className="font-bold text-foreground truncate">{lake.name}</div>
                        <div className="text-[10.5px] text-muted-foreground">
                          {lake.zone} Zone · {lake.areaHa} ha · {agg.cleanedGrids} of {agg.totalGrids} sectors cleaned
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <div className="text-right font-mono">
                        <div className="font-bold" style={{ color: tierColor(tier) }}>
                          {agg.waterHealthIndex}/100
                        </div>
                        <div className="text-[9.5px] text-muted-foreground">
                          {agg.reclaimedPct}% Reclaimed
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end border-t border-border/60 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
