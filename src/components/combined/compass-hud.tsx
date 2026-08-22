import { Compass, Navigation, Radio, Satellite, ShieldCheck, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

export function CompassHud({
  heading,
  speed,
  satellites,
  lat,
  lon,
  battery = 84,
  voltage = 24.6,
}: {
  heading: number;
  speed: number;
  satellites: number;
  lat: number;
  lon: number;
  battery?: number;
  voltage?: number;
}) {
  const cardinal =
    heading >= 337.5 || heading < 22.5
      ? "N"
      : heading < 67.5
        ? "NE"
        : heading < 112.5
          ? "E"
          : heading < 157.5
            ? "SE"
            : heading < 202.5
              ? "S"
              : heading < 247.5
                ? "SW"
                : heading < 292.5
                  ? "W"
                  : "NW";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border border-panel-border bg-panel p-2.5">
      {/* Compass Dial Mini */}
      <div className="flex items-center gap-2.5">
        <div className="relative flex size-12 items-center justify-center rounded-full border border-panel-border bg-secondary/50">
          <div
            className="absolute size-9 transition-transform duration-300"
            style={{ transform: `rotate(${heading}deg)` }}
          >
            <div className="mx-auto h-3.5 w-1 bg-red-500 clip-arrow" />
            <div className="mx-auto h-3.5 w-1 bg-muted-foreground opacity-50" />
          </div>
          <span className="font-mono text-[9px] font-bold text-foreground">{cardinal}</span>
        </div>

        <div>
          <div className="hud-label text-[8px]">DIGITAL COMPASS // HMC5883L</div>
          <div className="font-mono text-sm font-bold text-foreground">
            {heading.toString().padStart(3, "0")}° <span className="text-[10px] text-signal font-normal">{cardinal}</span>
          </div>
          <div className="font-mono text-[8px] text-muted-foreground">True North Locked</div>
        </div>
      </div>

      {/* GPS & Navigation Telemetry */}
      <div className="flex items-center gap-4 border-x border-panel-border/60 px-3 font-mono text-[9px]">
        <div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Satellite className="size-3 text-data" />
            <span>NEO-6M GPS FIX</span>
          </div>
          <div className="font-bold text-foreground">
            {lat.toFixed(5)}°N, {lon.toFixed(5)}°E
          </div>
          <div className="text-[8px] text-emerald-400">3D FIX · {satellites} SATELLITES</div>
        </div>

        <div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Gauge className="size-3 text-signal" />
            <span>SURFACE SPEED</span>
          </div>
          <div className="font-bold text-signal">
            {speed} m/s <span className="text-[8px] text-muted-foreground">({(speed * 3.6).toFixed(1)} km/h)</span>
          </div>
          <div className="text-[8px] text-muted-foreground">THRUSTER NOMINAL</div>
        </div>
      </div>

      {/* Power & Bus Telemetry */}
      <div className="flex items-center gap-3 font-mono text-[9px]">
        <div>
          <div className="text-muted-foreground">ROBOT POWER BUS</div>
          <div className="flex items-center gap-1.5 font-bold text-foreground">
            <span className="text-signal">{battery}% BATT</span>
            <span className="text-data">{voltage}V</span>
          </div>
          <div className="text-[8px] text-signal">TRL-8 AUTONOMOUS</div>
        </div>
      </div>
    </div>
  );
}
