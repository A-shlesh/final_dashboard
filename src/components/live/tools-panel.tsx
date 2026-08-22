import { useState } from "react";
import { Edit3, Grid3x3, MapPin, Plus, RotateCcw, Save, Undo2, X } from "lucide-react";
import { CELL_COLOR, ZONES, type LakeEntity } from "@/lib/water-data";

export type PlaceMode = "lake" | "node" | "boundary" | null;
export type PendingLake = { lng: number; lat: number };

export function ToolsPanel({
  placeMode,
  onPlaceMode,
  showGrid,
  onShowGrid,
  pending,
  onCancelPending,
  onCreateLake,
  customLakes,
  markedCount,
  onJump,
  selectedLake,
  boundaryPointsCount = 0,
  onUndoBoundaryPoint,
  onClearBoundaryPoints,
  onSaveBoundary,
  onResetBoundaryToPreset,
}: {
  placeMode: PlaceMode;
  onPlaceMode: (m: PlaceMode) => void;
  showGrid: boolean;
  onShowGrid: (v: boolean) => void;
  pending: PendingLake | null;
  onCancelPending: () => void;
  onCreateLake: (name: string, zone: string, areaHa: number) => void;
  customLakes: LakeEntity[];
  markedCount: number;
  onJump: (lake: LakeEntity) => void;
  selectedLake?: LakeEntity | null;
  boundaryPointsCount?: number;
  onUndoBoundaryPoint?: () => void;
  onClearBoundaryPoints?: () => void;
  onSaveBoundary?: () => void;
  onResetBoundaryToPreset?: (lakeId: string) => void;
}) {
  const [name, setName] = useState("");
  const [zone, setZone] = useState(ZONES[0] ?? "West");
  const [area, setArea] = useState("12");

  const btn = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-1.5 border px-2 py-1.5 font-mono text-[9.5px] uppercase tracking-widest transition-colors ${
      active
        ? "border-signal bg-signal text-primary-foreground font-bold"
        : "border-panel-border text-muted-foreground hover:text-foreground hover:bg-secondary/40"
    }`;

  return (
    <div className="glass-panel p-3.5">
      <div className="hud-label mb-2">Survey & Boundary Tools</div>

      <div className="grid grid-cols-2 gap-1.5">
        <button
          className={btn(placeMode === "lake")}
          onClick={() => onPlaceMode(placeMode === "lake" ? null : "lake")}
        >
          <Plus className="size-3" /> Add Lake
        </button>
        <button
          className={btn(placeMode === "node")}
          onClick={() => onPlaceMode(placeMode === "node" ? null : "node")}
        >
          <MapPin className="size-3" /> Mark Node
        </button>
      </div>

      {/* Edit Boundary Mode Button */}
      <button
        className={`mt-1.5 w-full ${btn(placeMode === "boundary")}`}
        onClick={() => onPlaceMode(placeMode === "boundary" ? null : "boundary")}
      >
        <Edit3 className="size-3" /> {placeMode === "boundary" ? "Drawing Boundary..." : "Edit / Draw Boundary"}
      </button>

      <button className={`mt-1.5 w-full ${btn(showGrid)}`} onClick={() => onShowGrid(!showGrid)}>
        <Grid3x3 className="size-3" /> Grid overlay {showGrid ? "on" : "off"}
      </button>

      {/* Boundary Drawing Mode Active UI */}
      {placeMode === "boundary" && (
        <div className="mt-2 border border-signal/60 bg-signal/15 p-2.5 font-mono text-[9.5px]">
          <div className="flex items-center justify-between font-bold text-signal">
            <span>CUSTOM SHORELINE EDITOR</span>
            <span>{boundaryPointsCount} pts</span>
          </div>
          <p className="mt-1 text-[8.5px] leading-tight text-foreground/80">
            Click points on the map around the real lake perimeter to trace its full shoreline boundary.
          </p>

          <div className="mt-2 grid grid-cols-2 gap-1">
            <button
              onClick={onUndoBoundaryPoint}
              disabled={boundaryPointsCount === 0}
              className="flex items-center justify-center gap-1 border border-panel-border bg-secondary/80 py-1 text-muted-foreground disabled:opacity-40 hover:text-foreground"
            >
              <Undo2 className="size-2.5" /> Undo
            </button>
            <button
              onClick={onClearBoundaryPoints}
              disabled={boundaryPointsCount === 0}
              className="flex items-center justify-center gap-1 border border-panel-border bg-secondary/80 py-1 text-red-400 disabled:opacity-40 hover:bg-red-500/20"
            >
              Clear
            </button>
          </div>

          <button
            disabled={boundaryPointsCount < 3}
            onClick={onSaveBoundary}
            className="mt-1.5 flex w-full items-center justify-center gap-1 bg-signal py-1.5 font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-40 hover:opacity-90"
          >
            <Save className="size-3" /> Save & Distribute Grid ({boundaryPointsCount} pts)
          </button>

          {selectedLake && onResetBoundaryToPreset && (
            <button
              onClick={() => onResetBoundaryToPreset(selectedLake.id)}
              className="mt-1 flex w-full items-center justify-center gap-1 border border-panel-border bg-secondary/40 py-1 text-[8.5px] text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-2.5" /> Reset to Full Lake Survey Boundary
            </button>
          )}
        </div>
      )}

      {placeMode === "lake" && !pending && (
        <div className="mt-2 border border-signal/50 bg-signal/10 p-2 font-mono text-[9.5px] uppercase tracking-wide text-signal">
          Click the map to place a new water body
        </div>
      )}

      {placeMode === "node" && !pending && (
        <div className="mt-2 border border-signal/50 bg-signal/10 p-2 font-mono text-[9.5px] uppercase tracking-wide text-signal">
          Click the map to mark a sensor buoy node
        </div>
      )}

      {pending && (
        <div className="mt-2 border border-panel-border bg-secondary/40 p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="hud-label">New water body</span>
            <button onClick={onCancelPending} aria-label="Cancel">
              <X className="size-3 text-muted-foreground" />
            </button>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Water body name"
            className="mb-1.5 w-full border border-panel-border bg-background/60 px-2 py-1.5 text-[12px] outline-none focus:border-signal"
          />
          <div className="mb-1.5 flex gap-1.5">
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="flex-1 border border-panel-border bg-background/60 px-2 py-1.5 text-[11px] text-muted-foreground outline-none focus:border-signal"
            >
              {ZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
            <input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              inputMode="numeric"
              className="w-16 border border-panel-border bg-background/60 px-2 py-1.5 text-[11px] outline-none focus:border-signal"
              aria-label="Area in hectares"
            />
          </div>
          <div className="mb-2 font-mono text-[9px] text-muted-foreground">
            {pending.lat.toFixed(4)}, {pending.lng.toFixed(4)} · ha
          </div>
          <button
            disabled={!name.trim()}
            onClick={() => {
              onCreateLake(name.trim(), zone, Number(area) || 10);
              setName("");
            }}
            className="w-full bg-signal px-2 py-1.5 font-mono text-[9.5px] uppercase tracking-widest text-primary-foreground disabled:opacity-40"
          >
            Register water body
          </button>
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between border-t border-panel-border pt-2 font-mono text-[9.5px] text-muted-foreground">
        <span>{customLakes.length} added</span>
        <span>{markedCount} marked nodes</span>
      </div>

      {customLakes.length > 0 && (
        <div className="mt-1.5 max-h-24 overflow-y-auto">
          {customLakes.map((l) => (
            <button
              key={l.id}
              onClick={() => onJump(l)}
              className="flex w-full items-center gap-2 px-1 py-1 text-left text-[11.5px] hover:bg-accent/50"
            >
              <span className="size-1.5 rounded-full" style={{ background: CELL_COLOR.untouched }} />
              <span className="truncate">{l.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
