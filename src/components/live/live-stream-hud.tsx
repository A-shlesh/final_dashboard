import {
  CheckCircle2,
  Lock,
  Pause,
  Play,
  Radio,
  RefreshCw,
  X,
  Droplets,
  Thermometer,
  Wind,
  Zap,
  Flame,
} from "lucide-react";
import type { HardwareTelemetryPacket } from "@/lib/robot-telemetry-service";

export function LiveStreamHud({
  isStreaming,
  packet,
  lockedGps,
  packetCount,
  onStop,
  onStart,
  onClose,
}: {
  isStreaming: boolean;
  packet: HardwareTelemetryPacket | null;
  lockedGps: { lat: number; lng: number; compass: number } | null;
  packetCount: number;
  onStop: () => void;
  onStart: () => void;
  onClose?: () => void;
}) {
  if (!packet && !isStreaming) return null;

  return (
    <div className="rounded-2xl border border-border/80 bg-background/95 p-3.5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex size-2.5 items-center justify-center">
            {isStreaming ? (
              <>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
              </>
            ) : (
              <span className="relative inline-flex size-2.5 rounded-full bg-amber-500" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display text-xs font-bold text-foreground">
                {isStreaming ? "Real-Time Sensor Stream" : "Session Finalized (Stopped)"}
              </span>
              <span
                className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${
                  isStreaming
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                }`}
              >
                {isStreaming ? "0.5 Hz · 2s Lag" : "Permanent Lock"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">
            #{packetCount} pkts
          </span>
          <button
            onClick={isStreaming ? onStop : onStart}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold shadow-sm transition-all ${
              isStreaming
                ? "bg-destructive text-destructive-foreground hover:opacity-90 animate-pulse"
                : "bg-emerald-500 text-black hover:bg-emerald-400"
            }`}
          >
            {isStreaming ? (
              <>
                <Pause className="size-3" />
                <span>Stop Stream</span>
              </>
            ) : (
              <>
                <Play className="size-3 fill-current" />
                <span>Start New Point</span>
              </>
            )}
          </button>
          {onClose && !isStreaming && (
            <button
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Dismiss Stream HUD"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Static Locked GPS Coordinates Header */}
      {lockedGps && (
        <div className="mt-2.5 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-[11px]">
          <div className="flex items-center gap-1.5 font-medium text-primary">
            <Lock className="size-3 text-primary shrink-0" />
            <span className="text-[10px] uppercase font-bold tracking-wider">
              {isStreaming ? "Static Location Lock:" : "Surveyed Location:"}
            </span>
            <span className="font-mono font-bold text-foreground">
              {lockedGps.lat.toFixed(6)}, {lockedGps.lng.toFixed(6)}
            </span>
          </div>
          <div className="font-mono text-[10px] text-muted-foreground">
            {lockedGps.compass}° Heading
          </div>
        </div>
      )}

      {/* Real-Time Streaming Sensors */}
      {packet && (
        <div className="mt-2.5 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          <StreamTile
            icon={Wind}
            label="TDS"
            value={packet.sensors.tds != null ? `${packet.sensors.tds}` : "—"}
            unit={packet.sensors.tds != null ? "ppm" : ""}
            color={packet.sensors.tds != null ? "text-blue-400" : "text-muted-foreground"}
            isStreaming={isStreaming}
          />
          <StreamTile
            icon={Droplets}
            label="Turbidity"
            value={packet.sensors.turbidity != null ? `${packet.sensors.turbidity}` : "—"}
            unit={packet.sensors.turbidity != null ? "NTU" : ""}
            color={packet.sensors.turbidity != null ? "text-cyan-400" : "text-muted-foreground"}
            isStreaming={isStreaming}
          />
          <StreamTile
            icon={Zap}
            label="pH"
            value={packet.sensors.ph != null ? `${packet.sensors.ph}` : "—"}
            unit=""
            color={packet.sensors.ph != null ? "text-emerald-400" : "text-muted-foreground"}
            isStreaming={isStreaming}
          />
          <StreamTile
            icon={Thermometer}
            label="Temp"
            value={packet.sensors.air_temperature != null ? `${packet.sensors.air_temperature}` : "—"}
            unit={packet.sensors.air_temperature != null ? "°C" : ""}
            color={packet.sensors.air_temperature != null ? "text-rose-400" : "text-muted-foreground"}
            isStreaming={isStreaming}
          />
          <StreamTile
            icon={Droplets}
            label="Humidity"
            value={packet.sensors.humidity != null ? `${packet.sensors.humidity}` : "—"}
            unit={packet.sensors.humidity != null ? "%" : ""}
            color={packet.sensors.humidity != null ? "text-indigo-400" : "text-muted-foreground"}
            isStreaming={isStreaming}
          />
          <StreamTile
            icon={Flame}
            label="MQ-135"
            value={packet.sensors.mq135 != null ? `${packet.sensors.mq135}` : "—"}
            unit={packet.sensors.mq135 != null ? "ppm" : ""}
            color={packet.sensors.mq135 != null ? "text-amber-400" : "text-muted-foreground"}
            isStreaming={isStreaming}
          />
        </div>
      )}

      {!isStreaming && (
        <div className="mt-2.5 flex items-center justify-between rounded-lg bg-secondary/40 px-2.5 py-1.5 text-[10.5px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-emerald-500" />
            <span>Telemetry stopped. Click <strong>Start New Point</strong> to sample another coordinate.</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StreamTile({
  icon: Icon,
  label,
  value,
  unit,
  color = "text-foreground",
  isStreaming,
}: {
  icon: typeof Wind;
  label: string;
  value: string;
  unit: string;
  color?: string;
  isStreaming: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-secondary/30 p-2 text-center shadow-sm relative overflow-hidden">
      {isStreaming && (
        <div className="absolute top-1 right-1 size-1.5 rounded-full bg-emerald-500 animate-pulse" />
      )}
      <div className="flex items-center justify-center gap-1 text-muted-foreground">
        <Icon className="size-3" />
        <span className="text-[9.5px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-0.5 font-mono text-sm font-bold tracking-tight">
        <span className={color}>{value}</span>
        {unit && <span className="text-[9px] text-muted-foreground ml-0.5 font-normal">{unit}</span>}
      </div>
    </div>
  );
}
