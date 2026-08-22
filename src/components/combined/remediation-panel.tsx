import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { computeRemediationEffectiveness } from "@/lib/water-analytics";
import { type SensorReading } from "@/lib/kengeri-simulation";
import { TrendingUp, TrendingDown, ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const axisStyle = {
  stroke: "var(--muted-foreground)",
  fontSize: 8.5,
  fontFamily: "var(--font-data)",
};

export function RemediationPanel({ readings }: { readings: SensorReading[] }) {
  const result = computeRemediationEffectiveness(readings);

  const isPositive = result.improvementPct > 0;
  const isNeutral = result.improvementPct === 0;

  return (
    <div className="border border-panel-border bg-panel p-3">
      <div className="mb-3 flex items-center justify-between border-b border-panel-border/60 pb-2">
        <div>
          <div className="hud-label">Remediation Effectiveness & Phase Progression</div>
          <div className="font-mono text-[9px] text-muted-foreground">
            5-segment mission breakdown evaluating WQI recovery and hotspot containment
          </div>
        </div>

        {/* Big Improvement Badge */}
        <div className="flex items-center gap-2 border border-panel-border bg-secondary/60 px-3 py-1">
          {isPositive ? (
            <TrendingUp className="size-4 text-emerald-400" />
          ) : isNeutral ? (
            <ArrowRight className="size-4 text-amber-400" />
          ) : (
            <TrendingDown className="size-4 text-red-400" />
          )}
          <div>
            <div className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground">Overall WQI Delta</div>
            <div
              className={cn(
                "font-mono text-base font-bold tabular-nums",
                isPositive ? "text-emerald-400" : isNeutral ? "text-amber-400" : "text-red-400"
              )}
            >
              {result.improvementPct > 0 ? `+${result.improvementPct}%` : `${result.improvementPct}%`}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Phase Bar Chart */}
        <div className="lg:col-span-2">
          <div className="mb-1 flex justify-between font-mono text-[9px] text-muted-foreground">
            <span>Average WQI Per Mission Phase</span>
            <span className="text-signal">Target: ≥ 76 (Good/Reclaimed)</span>
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={result.phases} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--panel-border)" strokeDasharray="2 3" vertical={false} />
                <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={{ stroke: "var(--panel-border)" }} />
                <YAxis domain={[0, 100]} tick={axisStyle} tickLine={false} axisLine={false} width={34} />
                <Tooltip
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload;
                    return (
                      <div className="border border-panel-border bg-popover p-2 font-mono text-[9px] shadow-lg">
                        <div className="font-bold text-foreground">{p.label} ({p.timeRange})</div>
                        <div className="text-signal">Avg WQI: <b>{p.avgWqi}</b></div>
                        <div className="text-red-400">Hotspots: <b>{p.hotspotsFound}</b></div>
                        <div className="text-muted-foreground">Readings: {p.readingsCount}</div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="avgWqi" radius={[2, 2, 0, 0]}>
                  {result.phases.map((p, i) => (
                    <Cell
                      key={`cell-${i}`}
                      fill={p.avgWqi >= 76 ? "#34d399" : p.avgWqi >= 51 ? "#f5b942" : "#f87171"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Phase Breakdown Table */}
        <div className="flex flex-col justify-between border border-panel-border bg-secondary/30 p-2.5">
          <div>
            <div className="hud-label mb-1.5 text-[9px]">Phase Summary Table</div>
            <table className="w-full font-mono text-[8.5px]">
              <thead>
                <tr className="border-b border-panel-border text-muted-foreground">
                  <th className="py-0.5 text-left">PHASE</th>
                  <th className="py-0.5 text-right">AVG WQI</th>
                  <th className="py-0.5 text-right">HOTSPOTS</th>
                </tr>
              </thead>
              <tbody>
                {result.phases.map((p) => (
                  <tr key={p.phase} className="border-b border-panel-border/40">
                    <td className="py-1 text-foreground/90">{p.label}</td>
                    <td className="py-1 text-right font-bold text-signal">{p.avgWqi}</td>
                    <td className="py-1 text-right text-red-400">{p.hotspotsFound}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-2 border-t border-panel-border/60 pt-2 font-mono text-[8px] text-muted-foreground">
            <div className="flex justify-between">
              <span>Initial WQI: <b>{result.initialWqi}</b></span>
              <span>Final WQI: <b className="text-signal">{result.finalWqi}</b></span>
            </div>
            <div className="mt-1 text-right text-emerald-400">
              Hotspot Reduction: <b>{result.hotspotReductionPct}%</b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
