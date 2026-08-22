import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { METRICS, isNominal, type Cell } from "@/lib/scrub-data";
import { Panel } from "./primitives";

export function TelemetryPanel({ cell }: { cell: Cell | null }) {
  const [jitter, setJitter] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setJitter(Math.random()), 1200);
    return () => clearInterval(i);
  }, []);

  return (
    <Panel
      title="Live Telemetry"
      right={
        <span className={cn("font-mono text-[10px]", cell ? "animate-blink text-signal" : "text-muted-foreground")}>
          {cell ? "● STREAMING" : "○ NO LOCK"}
        </span>
      }
      bodyClassName="p-3"
    >
      <div className="mb-3 border border-panel-border bg-secondary/40 p-2">
        <div className="hud-label">Sensor Target</div>
        <div className="font-mono text-sm text-data">{cell ? cell.id : "— — —"}</div>
        <div className="mt-1 font-mono text-[10px] text-muted-foreground">
          {cell ? `SECTOR ${cell.sector} · ${cell.swept ? "SWEPT" : "PENDING SWEEP"} · DEBRIS ${cell.debris} kg` : "Hover a grid cell to acquire lock"}
        </div>
      </div>

      <div className="space-y-3">
        {METRICS.map((m) => {
          const raw = cell ? (cell[m.key] as number) : null;
          const live = raw === null ? null : raw + (raw * (jitter - 0.5)) / 220;
          const pct = live === null ? 0 : ((live - m.min) / (m.max - m.min)) * 100;
          const ok = live !== null && isNominal(m, live);
          const tone = live === null ? "text-muted-foreground" : ok ? "text-signal" : "text-critical";
          return (
            <div key={m.key}>
              <div className="flex items-end justify-between">
                <span className="hud-label">{m.label}</span>
                <span className={cn("font-mono text-xl leading-none tabular-nums", tone, live !== null && "text-glow")}>
                  {live === null ? "--.--" : live.toFixed(m.decimals)}
                  <span className="ml-1 text-[10px] text-muted-foreground">{m.unit}</span>
                </span>
              </div>
              <div className="relative mt-1.5 h-[6px] w-full bg-secondary">
                <div
                  className="absolute inset-y-0 bg-signal/15"
                  style={{
                    left: `${((m.nominal[0] - m.min) / (m.max - m.min)) * 100}%`,
                    width: `${((m.nominal[1] - m.nominal[0]) / (m.max - m.min)) * 100}%`,
                  }}
                />
                <div
                  className={cn("absolute inset-y-0 left-0 transition-[width] duration-500", ok ? "bg-signal" : "bg-critical")}
                  style={{ width: `${Math.max(0, Math.min(100, pct))}%`, opacity: live === null ? 0.15 : 1 }}
                />
              </div>
              <div className="mt-0.5 flex justify-between font-mono text-[9px] text-muted-foreground">
                <span>{m.min}</span>
                <span>
                  NOMINAL {m.nominal[0]}–{m.nominal[1]}
                </span>
                <span>{m.max}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t border-panel-border pt-3">
        <div className="hud-label mb-1">Bloom Risk Index</div>
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 bg-secondary">
            <div
              className={cn("h-full", (cell?.bloomRisk ?? 0) > 0.62 ? "bg-critical" : (cell?.bloomRisk ?? 0) > 0.35 ? "bg-caution" : "bg-signal")}
              style={{ width: `${(cell?.bloomRisk ?? 0) * 100}%` }}
            />
          </div>
          <span className="font-mono text-xs text-foreground">{cell ? `${Math.round(cell.bloomRisk * 100)}%` : "--"}</span>
        </div>
      </div>
    </Panel>
  );
}
