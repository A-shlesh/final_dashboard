import { AlertCircle, Clock } from "lucide-react";
import { ANOMALIES, TIER_COLOR, type LakeEntity } from "@/lib/water-data";

export function AnomalyFeed({
  lakes,
  onSelectLake,
}: {
  lakes: LakeEntity[];
  onSelectLake: (lake: LakeEntity) => void;
}) {
  return (
    <div className="flex max-h-[220px] w-full flex-col overflow-hidden rounded-xl border border-border/80 bg-background/90 p-3 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-border/60 pb-2 px-1">
        <div className="flex items-center gap-1.5">
          <AlertCircle className="size-3.5 text-amber-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Threat & Anomaly Feed
          </h3>
        </div>
        <span className="flex size-2 rounded-full bg-red-500 animate-pulse" />
      </div>

      <div className="mt-2 flex-1 overflow-y-auto space-y-1.5 pr-1">
        {ANOMALIES.map((a, i) => {
          const lake = lakes.find((l) => l.id === a.lakeId);
          if (!lake) return null;
          return (
            <button
              key={i}
              onClick={() => onSelectLake(lake)}
              className="flex w-full items-start gap-2.5 rounded-lg border border-border/40 bg-secondary/20 p-2 text-left transition-all hover:bg-accent/50 hover:border-border"
            >
              <span
                className="mt-1 size-2 shrink-0 rounded-full"
                style={{ backgroundColor: TIER_COLOR[a.sev] }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-foreground leading-snug">
                  <span className="font-bold">{lake.name}</span> — {a.msg}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="size-3" />
                  <span>{a.hoursAgo}h ago</span>
                  <span>·</span>
                  <span>{lake.zone} Zone</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
