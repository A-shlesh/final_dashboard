import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { ANOMALIES, BIOMASS_SERIES, MODELS, QUALITY_DELTA } from "@/lib/scrub-data";
import { Panel } from "./primitives";

const axis = { stroke: "var(--muted-foreground)", fontSize: 9, fontFamily: "var(--font-data)" };

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-panel-border bg-popover px-2 py-1 font-mono text-[10px]">
      <div className="text-muted-foreground">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.dataKey}: {p.value}
        </div>
      ))}
    </div>
  );
}

export function AnalyticsPanel() {
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <Panel title="ML Pipeline" bodyClassName="p-2">
        <table className="w-full font-mono text-[10px]">
          <tbody>
            {MODELS.map((m) => (
              <tr key={m.name} className="border-b border-panel-border/60 last:border-0">
                <td className="py-1 text-foreground/90">{m.name}</td>
                <td className="py-1 text-muted-foreground">{m.ver}</td>
                <td className="py-1 text-right text-data">{m.acc}%</td>
                <td className={cn("py-1 pl-2 text-right", m.state === "RUNNING" ? "text-signal" : "text-caution")}>
                  {m.state === "RUNNING" ? "● " : "◐ "}
                  {m.state}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Predictive Biomass Growth" right={<span className="font-mono text-[10px] text-caution">LSTM v2.0</span>} bodyClassName="p-2">
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={BIOMASS_SERIES} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
              <defs>
                <linearGradient id="fc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--caution)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--caution)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--panel-border)" strokeDasharray="2 3" vertical={false} />
              <XAxis dataKey="t" tick={axis} tickLine={false} axisLine={{ stroke: "var(--panel-border)" }} interval={2} />
              <YAxis tick={axis} tickLine={false} axisLine={false} width={38} />
              <Tooltip content={<ChartTip />} cursor={{ stroke: "var(--signal)", strokeWidth: 0.5 }} />
              <Area type="monotone" dataKey="forecast" stroke="var(--caution)" strokeWidth={1.4} fill="url(#fc)" strokeDasharray="3 2" />
              <Line type="monotone" dataKey="actual" stroke="var(--signal)" strokeWidth={1.6} dot={false} connectNulls={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 font-mono text-[9px] leading-relaxed text-muted-foreground">
          FORECAST: HYACINTH MASS +68% BY W+3 — PREEMPTIVE SWEEP ADVISED ON SECTORS D5–G9.
        </p>
      </Panel>

      <Panel title="Water Quality Delta" right={<span className="font-mono text-[10px] text-signal">+21% YTD</span>} bodyClassName="p-2">
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={QUALITY_DELTA} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
              <CartesianGrid stroke="var(--panel-border)" strokeDasharray="2 3" vertical={false} />
              <XAxis dataKey="m" tick={axis} tickLine={false} axisLine={{ stroke: "var(--panel-border)" }} />
              <YAxis tick={axis} tickLine={false} axisLine={false} width={38} />
              <Tooltip content={<ChartTip />} />
              <Line type="monotone" dataKey="do" stroke="var(--signal)" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="ntu" stroke="var(--chart-3)" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="ph" stroke="var(--caution)" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Anomaly Detection Feed" right={<span className="animate-blink font-mono text-[10px] text-critical">2 CRITICAL</span>} bodyClassName="divide-y divide-panel-border/60">
        {ANOMALIES.map((a) => (
          <article key={a.id} className="px-2 py-1.5">
            <div className="flex items-center justify-between font-mono text-[9px]">
              <span
                className={cn(
                  a.severity === "CRITICAL" ? "text-critical" : a.severity === "WARN" ? "text-caution" : "text-muted-foreground",
                )}
              >
                [{a.severity}] {a.grid}
              </span>
              <span className="text-muted-foreground">{a.ts}</span>
            </div>
            <p className="mt-0.5 font-mono text-[10px] leading-snug text-foreground/85">{a.message}</p>
          </article>
        ))}
      </Panel>
    </div>
  );
}
