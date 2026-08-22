import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  buildGrid,
  GRID_COLS,
  GRID_ROWS,
  LAKES,
  STATUS_META,
  type Cell,
  type Lake,
} from "@/lib/scrub-data";

export type LayerKey = "standard" | "heatmap" | "radar" | "fleet" | "threat" | "path";

const CELL_W = 100 / GRID_COLS;
const CELL_H = 100 / GRID_ROWS;

function cellFill(cell: Cell, layers: Set<LayerKey>) {
  if (!cell.water) return "transparent";
  if (layers.has("threat") && cell.bloomRisk > 0.62)
    return `color-mix(in oklab, var(--critical) ${Math.round(cell.bloomRisk * 55)}%, transparent)`;
  if (layers.has("heatmap"))
    return `color-mix(in oklab, ${cell.dissolvedOxygen > 5 ? "var(--signal)" : cell.dissolvedOxygen > 3 ? "var(--caution)" : "var(--critical)"} ${Math.round(
      30 + cell.turbidity * 0.35,
    )}%, transparent)`;
  if (layers.has("radar"))
    return `color-mix(in oklab, var(--data) ${Math.round(cell.debris * 0.32)}%, transparent)`;
  return cell.swept ? "color-mix(in oklab, var(--signal) 8%, transparent)" : "transparent";
}

export function MapViewport({
  layers,
  selected,
  onSelect,
  onHoverCell,
  activeCell,
}: {
  layers: Set<LayerKey>;
  selected: Lake | null;
  onSelect: (lake: Lake | null) => void;
  onHoverCell: (cell: Cell | null) => void;
  activeCell: Cell | null;
}) {
  const grid = useMemo(() => (selected ? buildGrid(selected) : []), [selected]);
  const waypoints = useMemo(
    () =>
      grid
        .filter((c) => c.water && c.bloomRisk > 0.55)
        .sort((a, b) => b.bloomRisk - a.bloomRisk)
        .slice(0, 7)
        .sort((a, b) => a.col - b.col),
    [grid],
  );
  const [botT, setBotT] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    if (!selected) return;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setBotT((t) => (t + dt * 0.08) % 1);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [selected]);

  const path = waypoints.map((c) => ({ x: (c.col + 0.5) * CELL_W, y: (c.row + 0.5) * CELL_H }));
  const botPos = (() => {
    if (path.length < 2) return null;
    const seg = botT * (path.length - 1);
    const i = Math.floor(seg);
    const f = seg - i;
    const a = path[i]!;
    const b = path[Math.min(i + 1, path.length - 1)]!;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  })();

  return (
    <div className="panel-surface scanlines relative min-h-0 flex-1 overflow-hidden">
      {/* background lattice */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 92%)",
        }}
      />

      {/* corner brackets */}
      {["left-2 top-2 border-l border-t", "right-2 top-2 border-r border-t", "left-2 bottom-2 border-l border-b", "right-2 bottom-2 border-r border-b"].map(
        (c) => (
          <span key={c} className={cn("pointer-events-none absolute size-4 border-signal/60", c)} />
        ),
      )}

      <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
        <span className="hud-label">{selected ? "MICRO / GRID SURVEY" : "MACRO / BENGALURU BASIN"}</span>
        {selected && (
          <button
            onClick={() => {
              onSelect(null);
              onHoverCell(null);
            }}
            className="border border-panel-border bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-foreground/80 transition-colors hover:border-signal hover:text-signal"
          >
            ← zoom out
          </button>
        )}
      </div>

      <div className="absolute bottom-3 left-3 z-20 font-mono text-[10px] leading-relaxed text-muted-foreground">
        <div>LAT 12.9716° N &nbsp; LON 77.5946° E</div>
        <div>PROJ WGS-84 / UTM 43N &nbsp; SCALE {selected ? "1:2K" : "1:120K"}</div>
      </div>

      {!selected ? (
        <MacroMap onSelect={onSelect} />
      ) : (
        <div className="absolute inset-0 p-8 sm:p-12">
          <div className="relative h-full w-full">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <defs>
                <clipPath id="waterclip">
                  {grid
                    .filter((c) => c.water)
                    .map((c) => (
                      <rect key={c.id} x={c.col * CELL_W} y={c.row * CELL_H} width={CELL_W} height={CELL_H} />
                    ))}
                </clipPath>
              </defs>
              <g clipPath="url(#waterclip)">
                <rect x="0" y="0" width="100" height="100" fill="color-mix(in oklab, var(--data) 7%, transparent)" />
              </g>
              {grid.map((c) => (
                <rect
                  key={c.id}
                  x={c.col * CELL_W}
                  y={c.row * CELL_H}
                  width={CELL_W}
                  height={CELL_H}
                  fill={cellFill(c, layers)}
                  stroke={c.water ? "var(--grid-line)" : "oklch(0.4 0.02 250 / 18%)"}
                  strokeWidth="0.15"
                  className={cn("transition-colors", c.water && "cursor-crosshair")}
                  onMouseEnter={() => c.water && onHoverCell(c)}
                  onFocus={() => c.water && onHoverCell(c)}
                />
              ))}
              {activeCell && (
                <rect
                  x={activeCell.col * CELL_W}
                  y={activeCell.row * CELL_H}
                  width={CELL_W}
                  height={CELL_H}
                  fill="color-mix(in oklab, var(--signal) 18%, transparent)"
                  stroke="var(--signal)"
                  strokeWidth="0.4"
                  pointerEvents="none"
                />
              )}
              {layers.has("path") && path.length > 1 && (
                <>
                  <polyline
                    points={path.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke="var(--signal)"
                    strokeWidth="0.35"
                    strokeDasharray="1.6 1.2"
                    className="animate-dash"
                    opacity="0.9"
                  />
                  {path.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="0.7" fill="var(--signal)" opacity="0.85" />
                  ))}
                </>
              )}
              {layers.has("path") && botPos && (
                <g>
                  <circle cx={botPos.x} cy={botPos.y} r="2.4" fill="none" stroke="var(--caution)" strokeWidth="0.25" opacity="0.5" />
                  <rect x={botPos.x - 1} y={botPos.y - 1} width="2" height="2" fill="var(--caution)" />
                </g>
              )}
            </svg>

            {/* cell labels */}
            <div className="pointer-events-none absolute inset-0">
              {Array.from({ length: GRID_ROWS }).map((_, r) => (
                <span
                  key={r}
                  className="absolute -left-5 font-mono text-[9px] text-muted-foreground"
                  style={{ top: `${(r + 0.5) * CELL_H}%`, transform: "translateY(-50%)" }}
                >
                  {String.fromCharCode(65 + r)}
                </span>
              ))}
              {Array.from({ length: GRID_COLS }).map((_, c) => (
                <span
                  key={c}
                  className="absolute -top-5 font-mono text-[9px] text-muted-foreground"
                  style={{ left: `${(c + 0.5) * CELL_W}%`, transform: "translateX(-50%)" }}
                >
                  {c + 1}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="absolute right-3 top-3 z-20 flex flex-col items-end gap-1 font-mono text-[10px] text-muted-foreground">
        <span>{selected ? selected.name.toUpperCase() : "12 WATER BODIES TRACKED"}</span>
        {selected && <span className="text-signal">{GRID_COLS * GRID_ROWS} SECTORS / 25 m²</span>}
      </div>
    </div>
  );
}

function MacroMap({ onSelect }: { onSelect: (lake: Lake) => void }) {
  return (
    <div className="absolute inset-0">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <path
          d="M18 12 L46 6 L72 11 L88 26 L92 52 L82 78 L60 92 L34 90 L14 74 L8 44 Z"
          fill="color-mix(in oklab, var(--data) 3%, transparent)"
          stroke="var(--grid-line)"
          strokeWidth="0.25"
        />
        <path d="M8 44 L92 52 M46 6 L60 92 M14 74 L88 26" stroke="var(--grid-line)" strokeWidth="0.12" />
        <circle cx="50" cy="50" r="30" fill="none" stroke="var(--grid-line)" strokeWidth="0.12" />
        <circle cx="50" cy="50" r="16" fill="none" stroke="var(--grid-line)" strokeWidth="0.12" />
      </svg>

      {LAKES.map((lake) => {
        const meta = STATUS_META[lake.status];
        return (
          <button
            key={lake.id}
            onClick={() => onSelect(lake)}
            className="group absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${lake.x}%`, top: `${lake.y}%` }}
            aria-label={`Open ${lake.name}`}
          >
            <span className="relative flex size-3 items-center justify-center">
              {lake.status !== "untouched" && (
                <span
                  className="animate-ping-slow absolute size-3 rounded-none"
                  style={{ backgroundColor: meta.color, opacity: 0.35 }}
                />
              )}
              <span
                className="size-2 rotate-45 border"
                style={{ backgroundColor: meta.color, borderColor: meta.color, boxShadow: `0 0 10px ${meta.color}` }}
              />
            </span>
            <span className="absolute left-4 top-1/2 hidden -translate-y-1/2 whitespace-nowrap border border-panel-border bg-popover px-2 py-1 text-left font-mono text-[10px] leading-tight text-foreground group-hover:block">
              <span className="block">{lake.name.toUpperCase()}</span>
              <span className="block text-muted-foreground">
                {meta.label} · {lake.areaHa} ha · {lake.extractedKg} kg
              </span>
            </span>
          </button>
        );
      })}

      <div className="absolute bottom-3 right-3 z-20 border border-panel-border bg-panel/90 p-2">
        <div className="hud-label mb-1">Legend</div>
        {(["cleaned", "active", "untouched"] as const).map((s) => (
          <div key={s} className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            <span className="size-2 rotate-45" style={{ backgroundColor: STATUS_META[s].color }} />
            {STATUS_META[s].label}
          </div>
        ))}
      </div>
    </div>
  );
}
