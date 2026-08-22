import { Activity, Droplets, Map, ShieldCheck } from "lucide-react";
import { computeLakeAggregates, tierColor, tierOf, type LakeEntity } from "@/lib/water-data";

export function AnalyticsPanel({
  lakes,
  selectedLake,
}: {
  lakes: LakeEntity[];
  selectedLake: LakeEntity | null;
}) {
  const totalLakes = lakes.length;
  const totalHa = lakes.reduce((s, l) => s + (l.areaHa || 0), 0);

  // Compute aggregate statistics
  let totalCleanedHa = 0;
  let totalHealthSum = 0;

  lakes.forEach((l) => {
    const agg = computeLakeAggregates(l.grids ?? [], [l.lat, l.lng]);
    totalHealthSum += agg.waterHealthIndex;
    totalCleanedHa += (l.areaHa * agg.reclaimedPct) / 100;
  });

  const meanBasinHealth = Math.round(totalHealthSum / Math.max(1, totalLakes));
  const healthTier = tierOf(meanBasinHealth);

  return (
    <div className="rounded-xl border border-border/80 bg-background/90 p-4 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Reclamation Analytics
          </h3>
        </div>
        <span className="text-[10px] font-medium text-muted-foreground">Bengaluru Basin</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border/60 bg-secondary/20 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
            <Map className="size-3 text-muted-foreground" />
            <span>Water Bodies</span>
          </div>
          <div className="mt-1 text-lg font-bold text-foreground">
            {totalLakes} <span className="text-[10px] font-normal text-muted-foreground">({totalHa} ha)</span>
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-secondary/20 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
            <Droplets className="size-3 text-emerald-500" />
            <span>Reclaimed Area</span>
          </div>
          <div className="mt-1 text-lg font-bold text-emerald-500">
            {totalCleanedHa.toFixed(1)} <span className="text-[10px] font-normal text-muted-foreground">ha</span>
          </div>
        </div>

        <div className="col-span-2 rounded-lg border border-border/60 bg-secondary/20 p-2.5">
          <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="size-3 text-primary" />
              <span>Mean Basin Water Health</span>
            </div>
            <span
              className="rounded px-1.5 py-0.2 text-[9px] font-bold text-white uppercase"
              style={{ backgroundColor: tierColor(healthTier) }}
            >
              {healthTier}
            </span>
          </div>
          <div className="mt-1 text-xl font-extrabold" style={{ color: tierColor(healthTier) }}>
            {meanBasinHealth} <span className="text-xs font-normal text-muted-foreground">/ 100</span>
          </div>
        </div>
      </div>
    </div>
  );
}
