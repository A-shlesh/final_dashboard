import { Activity, Layers, Radar, Route as RouteIcon, ShieldAlert, Waves, Bot, Compass, FileText, Globe } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { LayerKey } from "./map-viewport";

const LAYERS: { key: LayerKey; label: string; icon: React.ElementType }[] = [
  { key: "standard", label: "Standard Map", icon: Layers },
  { key: "heatmap", label: "Ecological Heatmap", icon: Waves },
  { key: "radar", label: "Debris Radar", icon: Radar },
  { key: "threat", label: "Threat Map", icon: ShieldAlert },
  { key: "path", label: "Pathfinding", icon: RouteIcon },
  { key: "fleet", label: "Live Fleet Status", icon: Activity },
];

export type ActiveMainView = "kengeri" | "ops" | "compliance";

export function TopBar({
  layers,
  onToggle,
  view,
  onView,
  clock,
}: {
  layers: Set<LayerKey>;
  onToggle: (k: LayerKey) => void;
  view: ActiveMainView;
  onView: (v: ActiveMainView) => void;
  clock: string;
}) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-panel-border bg-panel px-4 py-2">
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="grid size-7 place-items-center border border-signal/60 font-mono text-[11px] font-bold text-signal">
            S
          </span>
          <h1 className="font-display text-lg font-semibold uppercase tracking-[0.22em] text-foreground">
            SCRUB <span className="text-signal">//</span> Command Center
          </h1>
        </Link>
      </div>

      {/* Main View Switcher */}
      <div className="flex border border-panel-border bg-secondary/30 p-0.5">
        <button
          onClick={() => onView("kengeri")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider transition-colors",
            view === "kengeri"
              ? "bg-signal/20 text-signal font-bold border border-signal/60"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Bot className="size-3.5 text-signal" />
          <span>Kengeri Live Robot (8 Sensors)</span>
        </button>

        <button
          onClick={() => onView("ops")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider transition-colors",
            view === "ops"
              ? "bg-signal/20 text-signal font-bold border border-signal/60"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Activity className="size-3.5" />
          <span>Micro Ops Grid</span>
        </button>

        <button
          onClick={() => onView("compliance")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider transition-colors",
            view === "compliance"
              ? "bg-signal/20 text-signal font-bold border border-signal/60"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <FileText className="size-3.5" />
          <span>Export / Compliance</span>
        </button>
      </div>

      {/* Micro Grid Layers (Active only in ops mode) */}
      {view === "ops" && (
        <nav className="hidden lg:flex flex-wrap items-center gap-1">
          {LAYERS.map((l) => {
            const on = layers.has(l.key);
            return (
              <button
                key={l.key}
                onClick={() => onToggle(l.key)}
                aria-pressed={on}
                className={cn(
                  "flex items-center gap-1.5 border px-2 py-1 font-mono text-[9.5px] uppercase tracking-widest transition-colors",
                  on
                    ? "border-signal/70 bg-signal/12 text-signal"
                    : "border-panel-border bg-secondary/40 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                )}
              >
                <l.icon className="size-3" />
                {l.label}
              </button>
            );
          })}
        </nav>
      )}

      {/* Right Action & Clock Section */}
      <div className="ml-auto flex items-center gap-3">
        <Link
          to="/"
          className="flex items-center gap-1 border border-panel-border bg-secondary/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:border-signal hover:text-signal"
        >
          <Globe className="size-3" />
          <span>Basin Observatory →</span>
        </Link>

        <div className="text-right font-mono text-[10px] leading-tight text-muted-foreground">
          <div className="text-signal">{clock} UTC</div>
          <div className="text-[8.5px]">TELEMETRY BUS ● ONLINE</div>
        </div>
      </div>
    </header>
  );
}
