import { useMemo, useState } from "react";
import {
  type SensorReading,
  KENGERI_LAKE_BOUNDARY,
  HOTSPOT_ZONES,
} from "@/lib/kengeri-simulation";
import { type PollutionCentroid, type SpatialCoverage } from "@/lib/water-analytics";
import { cn } from "@/lib/utils";
import { Crosshair, Eye, EyeOff, Layers, MapPin, Navigation, Radio, Sparkles, X } from "lucide-react";

export function KengeriMapView({
  readings,
  currentReading,
  centroid,
  coverage,
  showPath = true,
  showHotspots = true,
  showCentroid = true,
  showCoverageGrid = false,
  onToggleLayer,
}: {
  readings: SensorReading[];
  currentReading: SensorReading;
  centroid: PollutionCentroid | null;
  coverage: SpatialCoverage;
  showPath?: boolean;
  showHotspots?: boolean;
  showCentroid?: boolean;
  showCoverageGrid?: boolean;
  onToggleLayer?: (layer: "path" | "hotspots" | "centroid" | "grid") => void;
}) {
  const [selectedHotspot, setSelectedHotspot] = useState<SensorReading | null>(null);

  // Compute map bounding box
  const lats = KENGERI_LAKE_BOUNDARY.map((p) => p[0]);
  const lons = KENGERI_LAKE_BOUNDARY.map((p) => p[1]);
  const minLat = Math.min(...lats) - 0.0003;
  const maxLat = Math.max(...lats) + 0.0003;
  const minLon = Math.min(...lons) - 0.0003;
  const maxLon = Math.max(...lons) + 0.0003;

  // Convert GPS (lat, lon) to SVG (x, y) in 0-100 coordinate space
  const project = (lat: number, lon: number): [number, number] => {
    const x = ((lon - minLon) / (maxLon - minLon)) * 100;
    const y = (1 - (lat - minLat) / (maxLat - minLat)) * 100;
    return [x, y];
  };

  const boundaryPathD = useMemo(() => {
    return (
      KENGERI_LAKE_BOUNDARY.map((pt, i) => {
        const [x, y] = project(pt[0], pt[1]);
        return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      }).join(" ") + " Z"
    );
  }, []);

  const pathPointsD = useMemo(() => {
    if (!readings.length) return "";
    // Sample to avoid thousands of points
    const step = Math.max(1, Math.floor(readings.length / 350));
    const pts: string[] = [];
    for (let i = 0; i < readings.length; i += step) {
      const r = readings[i]!;
      const [x, y] = project(r.latitude, r.longitude);
      pts.push(`${pts.length === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    return pts.join(" ");
  }, [readings.length]);

  const hotspots = useMemo(() => {
    return readings.filter((r) => r.hotspot);
  }, [readings]);

  // Current robot location
  const [robotX, robotY] = project(currentReading.latitude, currentReading.longitude);

  // Centroid location & radius
  const centroidProj = centroid ? project(centroid.latitude, centroid.longitude) : null;
  const centroidRadiusX = centroid ? (centroid.radiusMeters / 111000 / (maxLon - minLon)) * 100 : 0;
  const centroidRadiusY = centroid ? (centroid.radiusMeters / 111000 / (maxLat - minLat)) * 100 : 0;

  return (
    <div className="panel-surface scanlines relative flex min-h-[480px] flex-1 flex-col overflow-hidden border border-panel-border bg-panel">
      {/* Background Lattice */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Top Map HUD Bar */}
      <div className="absolute left-3 top-3 z-20 flex flex-wrap items-center gap-2">
        <span className="hud-label bg-background/80 px-2 py-0.5 backdrop-blur-sm">
          KENGERI LAKE // 12.914°N, 77.490°E
        </span>
        <span className="border border-panel-border bg-background/80 px-2 py-0.5 font-mono text-[9px] text-signal backdrop-blur-sm">
          PATH RESOLUTION: 8cm ZIG-ZAG
        </span>
      </div>

      {/* Map Layer Controls */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1">
        {onToggleLayer && (
          <div className="flex border border-panel-border bg-background/90 p-0.5 backdrop-blur-sm">
            <button
              onClick={() => onToggleLayer("path")}
              className={cn(
                "px-2 py-0.5 font-mono text-[9px] transition-colors",
                showPath ? "bg-signal/20 text-signal font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Path
            </button>
            <button
              onClick={() => onToggleLayer("hotspots")}
              className={cn(
                "px-2 py-0.5 font-mono text-[9px] transition-colors",
                showHotspots ? "bg-red-500/20 text-red-400 font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Hotspots ({hotspots.length})
            </button>
            <button
              onClick={() => onToggleLayer("centroid")}
              className={cn(
                "px-2 py-0.5 font-mono text-[9px] transition-colors",
                showCentroid ? "bg-amber-500/20 text-amber-400 font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Source Centroid
            </button>
            <button
              onClick={() => onToggleLayer("grid")}
              className={cn(
                "px-2 py-0.5 font-mono text-[9px] transition-colors",
                showCoverageGrid ? "bg-cyan-500/20 text-cyan-400 font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Coverage Grid
            </button>
          </div>
        )}
      </div>

      {/* Main Vector Map SVG */}
      <div className="relative flex-1 p-6">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <defs>
            <clipPath id="kengeriClip">
              <path d={boundaryPathD} />
            </clipPath>
            <radialGradient id="hotspotGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f87171" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#f87171" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#f87171" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="centroidGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.6" />
              <stop offset="70%" stopColor="#f59e0b" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Lake Water Surface Background */}
          <path
            d={boundaryPathD}
            fill="color-mix(in oklab, var(--data) 10%, transparent)"
            stroke="var(--signal)"
            strokeWidth="0.35"
            strokeDasharray="2 1"
          />

          {/* Coverage Grid Cells Overlay */}
          {showCoverageGrid && (
            <g clipPath="url(#kengeriClip)">
              {coverage.gridCells.map((cell) => {
                const [cx, cy] = project(cell.lat, cell.lon);
                const intensity = Math.min(1, cell.count / 15);
                return (
                  <rect
                    key={cell.id}
                    x={cx - 1.2}
                    y={cy - 1.2}
                    width={2.4}
                    height={2.4}
                    fill={`rgba(0, 229, 255, ${0.15 + intensity * 0.35})`}
                    stroke="rgba(0, 229, 255, 0.4)"
                    strokeWidth="0.08"
                  />
                );
              })}
            </g>
          )}

          {/* Boustrophedon Traversal Path */}
          {showPath && pathPointsD && (
            <path
              d={pathPointsD}
              fill="none"
              stroke="var(--data)"
              strokeWidth="0.2"
              strokeDasharray="0.8 0.6"
              opacity="0.75"
            />
          )}

          {/* Pollution Source Triangulation Circle */}
          {showCentroid && centroidProj && (
            <g>
              <ellipse
                cx={centroidProj[0]}
                cy={centroidProj[1]}
                rx={Math.max(4, centroidRadiusX)}
                ry={Math.max(4, centroidRadiusY)}
                fill="url(#centroidGlow)"
                stroke="#f59e0b"
                strokeWidth="0.3"
                strokeDasharray="1.5 1"
                className="animate-pulse"
              />
              <circle
                cx={centroidProj[0]}
                cy={centroidProj[1]}
                r="1.2"
                fill="#f59e0b"
                stroke="#ffffff"
                strokeWidth="0.25"
              />
            </g>
          )}

          {/* Hotspot Markers */}
          {showHotspots &&
            hotspots.slice(0, 60).map((h) => {
              const [hx, hy] = project(h.latitude, h.longitude);
              return (
                <g
                  key={`hs-${h.index}`}
                  className="cursor-pointer transition-transform hover:scale-125"
                  onClick={() => setSelectedHotspot(h)}
                >
                  <circle cx={hx} cy={hy} r="1.4" fill="url(#hotspotGlow)" />
                  <circle cx={hx} cy={hy} r="0.6" fill="#ef4444" stroke="#ffffff" strokeWidth="0.15" />
                </g>
              );
            })}

          {/* Current Sweeping Robot Position & Heading Vector */}
          <g transform={`translate(${robotX}, ${robotY})`}>
            {/* Pulsing radar ping */}
            <circle cx="0" cy="0" r="3.2" fill="none" stroke="var(--signal)" strokeWidth="0.2" opacity="0.4" className="animate-ping" />
            {/* Robot Chassis */}
            <circle cx="0" cy="0" r="1.2" fill="var(--signal)" stroke="#ffffff" strokeWidth="0.3" />
            {/* Compass Heading Vector */}
            <g transform={`rotate(${currentReading.heading})`}>
              <line x1="0" y1="0" x2="0" y2="-4.5" stroke="var(--caution)" strokeWidth="0.35" strokeLinecap="round" />
              <polygon points="0,-4.8 -0.8,-3.2 0.8,-3.2" fill="var(--caution)" />
            </g>
          </g>
        </svg>
      </div>

      {/* Hotspot Hover / Click Detail Card */}
      {selectedHotspot && (
        <div className="absolute bottom-3 left-3 z-30 max-w-xs border border-red-500/60 bg-popover/95 p-2.5 font-mono text-[10px] shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-panel-border pb-1 text-red-400">
            <span className="font-bold">HOTSPOT TELEMETRY #{selectedHotspot.index}</span>
            <button
              onClick={() => setSelectedHotspot(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-1 text-[9px]">
            <div>GPS: {selectedHotspot.latitude.toFixed(5)}, {selectedHotspot.longitude.toFixed(5)}</div>
            <div>Time: {new Date(selectedHotspot.timestamp).toLocaleTimeString()}</div>
            <div>pH: <span className="font-bold text-red-400">{selectedHotspot.ph}</span></div>
            <div>Turbidity: <span className="font-bold text-red-400">{selectedHotspot.turbidity} NTU</span></div>
            <div>TDS: <span className="font-bold text-red-400">{selectedHotspot.tds} ppm</span></div>
            <div>Water Temp: <span className="font-bold">{selectedHotspot.watertemp} °C</span></div>
            <div>Gas CO: <span className="font-bold text-red-400">{selectedHotspot.gasCO} ppm</span></div>
            <div>Gas CH₄: <span className="font-bold text-red-400">{selectedHotspot.gasCH4} ppm</span></div>
          </div>
          <div className="mt-1 border-t border-panel-border/60 pt-1 text-[8.5px] text-muted-foreground">
            Point WQI: <span className="font-bold text-red-400">{selectedHotspot.wqi}</span> · Severity Breach Confirmed
          </div>
        </div>
      )}

      {/* Bottom Map Status Footer */}
      <div className="flex shrink-0 items-center justify-between border-t border-panel-border bg-panel/90 px-3 py-1.5 font-mono text-[9.5px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>ROBOT LAT: <b className="text-foreground">{currentReading.latitude.toFixed(6)}°N</b></span>
          <span>LON: <b className="text-foreground">{currentReading.longitude.toFixed(6)}°E</b></span>
          <span>HEADING: <b className="text-signal">{currentReading.heading}°</b></span>
        </div>
        <div className="flex items-center gap-2">
          {centroid && (
            <span className="text-amber-400">
              SOURCE PLUME: {centroid.latitude.toFixed(5)}, {centroid.longitude.toFixed(5)} (±{centroid.radiusMeters}m)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
