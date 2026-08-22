import { useState } from "react";
import { computePearsonCorrelationMatrix, type SENSOR_DISPLAY_NAMES } from "@/lib/water-analytics";
import { type SensorReading } from "@/lib/kengeri-simulation";
import { cn } from "@/lib/utils";

function getCorrColor(r: number): string {
  if (r >= 0.7) return "bg-red-500/80 text-white";
  if (r >= 0.4) return "bg-orange-500/60 text-white";
  if (r >= 0.1) return "bg-amber-500/30 text-amber-200";
  if (r > -0.1) return "bg-secondary/40 text-muted-foreground";
  if (r > -0.4) return "bg-cyan-500/30 text-cyan-200";
  if (r > -0.7) return "bg-blue-500/60 text-white";
  return "bg-indigo-600/80 text-white";
}

export function CorrelationHeatmap({ readings }: { readings: SensorReading[] }) {
  const { labels, matrix } = computePearsonCorrelationMatrix(readings);
  const [hoveredCell, setHoveredCell] = useState<{ i: number; j: number; val: number } | null>(null);

  return (
    <div className="border border-panel-border bg-panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="hud-label">Sensor Correlation Matrix (Pearson r)</div>
          <div className="font-mono text-[9px] text-muted-foreground">
            Co-pollutant correlation across 8 hardware channels
          </div>
        </div>
        {hoveredCell && (
          <div className="border border-panel-border bg-secondary/80 px-2 py-0.5 font-mono text-[9.5px] text-foreground">
            <span className="text-muted-foreground">{labels[hoveredCell.i]}</span> ↔{" "}
            <span className="text-muted-foreground">{labels[hoveredCell.j]}</span>:{" "}
            <b className={hoveredCell.val > 0.5 ? "text-red-400" : hoveredCell.val < -0.5 ? "text-cyan-400" : "text-signal"}>
              r = {hoveredCell.val}
            </b>
          </div>
        )}
      </div>

      {/* Heatmap Grid Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono text-[9px]">
          <thead>
            <tr>
              <th className="p-1 text-left text-muted-foreground"></th>
              {labels.map((l) => (
                <th key={l} className="p-1 text-center font-normal text-muted-foreground">
                  {l.split(" ")[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={labels[i]}>
                <td className="whitespace-nowrap pr-2 font-medium text-muted-foreground">
                  {labels[i]}
                </td>
                {row.map((val, j) => (
                  <td
                    key={`${i}-${j}`}
                    onMouseEnter={() => setHoveredCell({ i, j, val })}
                    onMouseLeave={() => setHoveredCell(null)}
                    className="p-0.5 text-center"
                  >
                    <div
                      className={cn(
                        "flex h-7 w-full min-w-[32px] items-center justify-center rounded-[2px] transition-transform hover:scale-110",
                        getCorrColor(val),
                        i === j && "opacity-40"
                      )}
                    >
                      {val.toFixed(2)}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Correlation Color Legend */}
      <div className="mt-3 flex items-center justify-between border-t border-panel-border/60 pt-2 font-mono text-[8.5px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="size-2 bg-indigo-600"></span>
          <span>Strong Negative (-1.0)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2 bg-secondary"></span>
          <span>Uncorrelated (0.0)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2 bg-red-500"></span>
          <span>Strong Positive (+1.0)</span>
        </div>
      </div>
    </div>
  );
}
