import { useMemo } from "react";
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
  ReferenceLine,
} from "recharts";
import { type SensorReading, SENSOR_THRESHOLDS } from "@/lib/kengeri-simulation";
import { analyzeSensorTimeSeries, SENSOR_KEYS, SENSOR_DISPLAY_NAMES } from "@/lib/water-analytics";
import { cn } from "@/lib/utils";

const axisStyle = {
  stroke: "var(--muted-foreground)",
  fontSize: 8,
  fontFamily: "var(--font-data)",
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-panel-border bg-popover/95 p-1.5 font-mono text-[9px] shadow-lg backdrop-blur-sm">
      <div className="text-muted-foreground">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <b>{p.value}</b>
        </div>
      ))}
    </div>
  );
}

export function SensorTimeseriesGrid({ readings }: { readings: SensorReading[] }) {
  // Sample readings if there are too many points for smooth Recharts rendering
  const data = useMemo(() => {
    if (readings.length <= 150) return readings;
    const step = Math.ceil(readings.length / 150);
    return readings.filter((_, i) => i % step === 0);
  }, [readings.length]);

  return (
    <div className="border border-panel-border bg-panel p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="hud-label">Multi-Channel Sensor Time-Series Analysis</div>
          <div className="font-mono text-[9px] text-muted-foreground">
            Linear regression trend slope, rolling average (window=10), and local Z-score spike detection
          </div>
        </div>
        <span className="font-mono text-[9px] text-data">{readings.length} points plotted</span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {SENSOR_KEYS.map((key) => {
          const meta = SENSOR_THRESHOLDS[key]!;
          const analysis = analyzeSensorTimeSeries(readings, key as any);
          const chartData = data.map((r, i) => ({
            time: new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            value: r[key as keyof SensorReading],
            rolling: analysis.rollingMean[i] ?? r[key as keyof SensorReading],
          }));

          const trendColor =
            analysis.trendLabel.includes("Rising")
              ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
              : analysis.trendLabel.includes("Falling")
                ? "text-blue-400 bg-blue-500/10 border-blue-500/30"
                : "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";

          return (
            <div key={key} className="flex flex-col justify-between border border-panel-border/80 bg-secondary/30 p-2.5">
              <div className="flex items-center justify-between border-b border-panel-border/50 pb-1.5">
                <div>
                  <span className="font-mono text-[10px] font-bold uppercase text-foreground">
                    {meta.label}
                  </span>
                  <span className="ml-1 font-mono text-[8.5px] text-muted-foreground">
                    ({meta.unit})
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={cn("border px-1.5 py-0.5 font-mono text-[8px] font-semibold", trendColor)}>
                    {analysis.trendLabel}
                  </span>
                  {analysis.spikeCount > 0 && (
                    <span className="border border-red-500/40 bg-red-500/20 px-1 py-0.5 font-mono text-[8px] font-bold text-red-400">
                      {analysis.spikeCount} Spikes
                    </span>
                  )}
                </div>
              </div>

              <div className="my-2 h-28 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                    <CartesianGrid stroke="var(--panel-border)" strokeDasharray="2 3" vertical={false} />
                    <XAxis dataKey="time" tick={axisStyle} tickLine={false} axisLine={{ stroke: "var(--panel-border)" }} interval="preserveStartEnd" />
                    <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={34} domain={["auto", "auto"]} />
                    <Tooltip content={<ChartTooltip />} />

                    {meta.high !== undefined && (
                      <ReferenceLine y={meta.high} stroke="#ef4444" strokeDasharray="3 2" strokeWidth={0.8} />
                    )}
                    {meta.low !== undefined && (
                      <ReferenceLine y={meta.low} stroke="#ef4444" strokeDasharray="3 2" strokeWidth={0.8} />
                    )}

                    <Line
                      type="monotone"
                      dataKey="value"
                      name="Raw Value"
                      stroke="var(--data)"
                      strokeWidth={1.2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="rolling"
                      name="Rolling Avg"
                      stroke="var(--signal)"
                      strokeWidth={1.6}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="flex justify-between border-t border-panel-border/50 pt-1 font-mono text-[8px] text-muted-foreground">
                <span>Min: {analysis.min}</span>
                <span>Avg: {analysis.avg}</span>
                <span>Max: {analysis.max}</span>
                <span>Slope: {analysis.slope}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
