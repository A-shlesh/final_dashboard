import { getWqiCategory } from "@/lib/water-analytics";
import { cn } from "@/lib/utils";

export function WqiRadialGauge({
  score,
  totalPoints,
  minPointWqi,
  maxPointWqi,
  avgPointWqi,
}: {
  score: number;
  totalPoints: number;
  minPointWqi: number;
  maxPointWqi: number;
  avgPointWqi: number;
}) {
  const cat = getWqiCategory(score);
  // Map 0-100 score to arc angle (-120 to +120 degrees)
  const angle = -120 + (score / 100) * 240;

  // Arc calculation parameters
  const size = 200;
  const cx = 100;
  const cy = 105;
  const radius = 70;
  const strokeWidth = 10;

  // Compute needle endpoint
  const rad = (angle * Math.PI) / 180;
  const nx = cx + (radius - 12) * Math.sin(rad);
  const ny = cy - (radius - 12) * Math.cos(rad);

  return (
    <div className="flex flex-col items-center justify-between border border-panel-border bg-panel p-3">
      <div className="w-full text-left">
        <div className="hud-label">Water Quality Index (WQI)</div>
        <div className="font-mono text-[10px] text-muted-foreground">IS:10500 Weighted Arithmetic Standard</div>
      </div>

      <div className="relative my-2 flex size-48 items-center justify-center">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
          <defs>
            <linearGradient id="wqiGradient" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="35%" stopColor="#fb923c" />
              <stop offset="60%" stopColor="#f5b942" />
              <stop offset="85%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>

          {/* Background Track Arc (-120° to +120°) */}
          <path
            d="M 39.38 140.0 A 70 70 0 1 1 160.62 140.0"
            fill="none"
            stroke="var(--secondary)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Color-graded active Arc */}
          <path
            d="M 39.38 140.0 A 70 70 0 1 1 160.62 140.0"
            fill="none"
            stroke="url(#wqiGradient)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            opacity="0.85"
          />

          {/* Central Pivot */}
          <circle cx={cx} cy={cy} r="6" fill="var(--panel-border)" stroke={cat.color} strokeWidth="2" />

          {/* Needle Indicator */}
          <line
            x1={cx}
            y1={cy}
            x2={nx}
            y2={ny}
            stroke={cat.color}
            strokeWidth="3"
            strokeLinecap="round"
            className="transition-all duration-500"
          />

          {/* Score display inside SVG */}
          <text
            x={cx}
            y={cy + 34}
            textAnchor="middle"
            fill="var(--foreground)"
            className="font-mono text-2xl font-bold"
          >
            {score.toFixed(0)}
          </text>
          <text
            x={cx}
            y={cy + 48}
            textAnchor="middle"
            fill={cat.color}
            className="font-mono text-[10px] font-semibold uppercase tracking-wider"
          >
            {cat.label}
          </text>
        </svg>

        {/* Zone Markers Labels */}
        <span className="absolute bottom-4 left-3 font-mono text-[8px] text-red-400">POOR</span>
        <span className="absolute bottom-4 right-3 font-mono text-[8px] text-emerald-400">EXCELLENT</span>
      </div>

      {/* Range and Telemetry Summary Table */}
      <div className="w-full border-t border-panel-border/60 pt-2 font-mono text-[9px]">
        <div className="flex justify-between text-muted-foreground">
          <span>Overall Health Status:</span>
          <span className="font-semibold" style={{ color: cat.color }}>
            {cat.label.toUpperCase()}
          </span>
        </div>
        <div className="mt-1 flex justify-between text-muted-foreground">
          <span>Per-Point WQI Bounds:</span>
          <span className="text-foreground">
            {minPointWqi.toFixed(0)} min · {avgPointWqi.toFixed(0)} avg · {maxPointWqi.toFixed(0)} max
          </span>
        </div>
        <div className="mt-1 flex justify-between text-muted-foreground">
          <span>Data Ingestion:</span>
          <span className="text-data">{totalPoints} readings processed</span>
        </div>
      </div>
    </div>
  );
}
