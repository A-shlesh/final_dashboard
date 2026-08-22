import {
  Check,
  Code2,
  Compass,
  Copy,
  Droplets,
  Flame,
  MapPin,
  Radio,
  Send,
  Sparkles,
  Thermometer,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { parseRawJsonPacket, type HardwareTelemetryPacket } from "@/lib/robot-telemetry-service";
import { useKeyboardArrowNav } from "@/lib/keyboard-nav";

export function LiveTelemetryModal({
  packet,
  isOpen,
  onClose,
  onInjectGrid,
  onApplyManualJson,
}: {
  packet: HardwareTelemetryPacket | null;
  isOpen: boolean;
  onClose: () => void;
  onInjectGrid?: () => void;
  onApplyManualJson?: (parsed: HardwareTelemetryPacket) => void;
}) {
  const containerRef = useKeyboardArrowNav<HTMLDivElement>(isOpen, onClose);
  const [copied, setCopied] = useState(false);
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [jsonText, setJsonText] = useState(
    JSON.stringify(
      {
        timestamp: 1724061000,
        latitude: 13.0827,
        longitude: 80.2707,
        tds: 412.5,
        turbidity: 18.2,
        ph: 7.34,
        air_temperature: 31.4,
        humidity: 68.2,
      },
      null,
      2,
    ),
  );
  const [jsonErr, setJsonErr] = useState("");

  if (!isOpen || !packet) return null;

  function handleCopy() {
    if (!packet) return;
    const exportObj = {
      timestamp: Math.floor(new Date(packet.timestamp).getTime() / 1000),
      latitude: packet.gps.lat,
      longitude: packet.gps.lng,
      tds: packet.sensors.tds,
      turbidity: packet.sensors.turbidity,
      ph: packet.sensors.ph,
      air_temperature: packet.sensors.air_temperature,
      humidity: packet.sensors.humidity,
    };
    navigator.clipboard.writeText(JSON.stringify(exportObj, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleApplyJson() {
    try {
      const parsed = parseRawJsonPacket(jsonText, "manual_json");
      setJsonErr("");
      if (onApplyManualJson) {
        onApplyManualJson(parsed);
      }
      setShowJsonEditor(false);
    } catch (err: any) {
      setJsonErr(`Invalid JSON syntax: ${err.message}`);
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        ref={containerRef}
        className="w-full max-w-lg rounded-2xl border border-border/80 bg-background/95 p-6 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95"
      >
        {/* Top Header */}
        <div className="flex items-start justify-between border-b border-border/60 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner">
              <Radio className="size-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold text-foreground">
                  In-Situ Hardware Telemetry
                </h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    packet.source === "live_pi"
                      ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
                      : packet.source === "manual_json"
                        ? "bg-purple-500/10 text-purple-400 border border-purple-500/30"
                        : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                  }`}
                >
                  {packet.source === "live_pi"
                    ? "● Live Raspberry Pi"
                    : packet.source === "manual_json"
                      ? "● Manual JSON Packet"
                      : "● Simulated Hardware"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Timestamp: <span className="font-mono text-foreground font-medium">{new Date(packet.timestamp).toLocaleString()}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowJsonEditor((p) => !p)}
              className={`rounded-lg p-1.5 transition-colors ${
                showJsonEditor ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
              title="Test Custom JSON Packet"
            >
              <Code2 className="size-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Optional JSON Input Panel */}
        {showJsonEditor && (
          <div className="my-3.5 rounded-xl border border-primary/40 bg-secondary/50 p-3 space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between text-[11px] font-bold text-foreground">
              <span>Paste Hardware JSON Packet</span>
              <span className="text-[10px] text-muted-foreground">Arduino / Pi Format</span>
            </div>
            <textarea
              rows={6}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              className="w-full font-mono text-xs rounded-lg border border-border bg-background p-2 text-foreground outline-none focus:border-primary"
            />
            {jsonErr && <div className="text-[11px] font-semibold text-destructive">{jsonErr}</div>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowJsonEditor(false)}
                className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyJson}
                className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90"
              >
                <Send className="size-3" />
                <span>Apply JSON to Map</span>
              </button>
            </div>
          </div>
        )}

        {/* GPS Location & Coordinates Ribbon */}
        <div className="my-4 grid grid-cols-2 gap-2.5 rounded-xl border border-primary/30 bg-primary/5 p-3.5">
          <div>
            <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-primary">
              <MapPin className="size-3.5" />
              <span>Latitude & Longitude</span>
            </div>
            <div className="mt-1 font-mono text-sm font-bold text-foreground">
              {packet.gps.lat.toFixed(6)}, {packet.gps.lng.toFixed(6)}
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              {packet.gps.lat >= 0 ? `${packet.gps.lat.toFixed(4)}° N` : `${Math.abs(packet.gps.lat).toFixed(4)}° S`},{" "}
              {packet.gps.lng >= 0 ? `${packet.gps.lng.toFixed(4)}° E` : `${Math.abs(packet.gps.lng).toFixed(4)}° W`}
            </div>
          </div>

          <div className="border-l border-border/60 pl-3">
            <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-primary">
              <Compass className="size-3.5" />
              <span>Location Context</span>
            </div>
            <div className="mt-1 font-mono text-sm font-bold text-foreground flex items-center gap-1.5">
              <span>{packet.compass}° Bearing</span>
            </div>
            {packet.matchedGridCode ? (
              <div className="mt-0.5 truncate text-[10px] font-medium text-emerald-500 flex items-center gap-1">
                <MapPin className="size-3" />
                <span>{packet.matchedLakeName} ({packet.matchedGridCode})</span>
              </div>
            ) : (
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                In-situ point marked on map
              </div>
            )}
          </div>
        </div>

        {/* Exact 5 Hardware Sensor Channels (Dishita's Schema) */}
        <div className="space-y-2">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
            Recorded In-Situ Sensor Values
          </div>

          <div className="grid grid-cols-3 gap-2">
            <SensorCard
              icon={Wind}
              label="TDS (Solids)"
              value={packet.sensors.tds != null ? `${packet.sensors.tds}` : "N/A"}
              unit={packet.sensors.tds != null ? "ppm" : ""}
              color={packet.sensors.tds != null ? "text-blue-400" : "text-muted-foreground"}
            />
            <SensorCard
              icon={Droplets}
              label="Turbidity"
              value={packet.sensors.turbidity != null ? `${packet.sensors.turbidity}` : "N/A"}
              unit={packet.sensors.turbidity != null ? "NTU" : ""}
              color={packet.sensors.turbidity != null ? "text-cyan-400" : "text-muted-foreground"}
            />
            <SensorCard
              icon={Zap}
              label="pH Value"
              value={packet.sensors.ph != null ? `${packet.sensors.ph}` : "N/A"}
              unit=""
              color={packet.sensors.ph != null ? "text-emerald-400" : "text-muted-foreground"}
            />
            <SensorCard
              icon={Thermometer}
              label="Air Temperature"
              value={packet.sensors.air_temperature != null ? `${packet.sensors.air_temperature}` : "N/A"}
              unit={packet.sensors.air_temperature != null ? "°C" : ""}
              color={packet.sensors.air_temperature != null ? "text-rose-400" : "text-muted-foreground"}
            />
            <SensorCard
              icon={Droplets}
              label="Humidity"
              value={packet.sensors.humidity != null ? `${packet.sensors.humidity}` : "N/A"}
              unit={packet.sensors.humidity != null ? "%" : ""}
              color={packet.sensors.humidity != null ? "text-indigo-400" : "text-muted-foreground"}
            />
            <SensorCard
              icon={Flame}
              label="Gas (MQ-135)"
              value={packet.sensors.mq135 != null ? `${packet.sensors.mq135}` : "N/A"}
              unit={packet.sensors.mq135 != null ? "ppm" : ""}
              color={packet.sensors.mq135 != null ? "text-amber-400" : "text-muted-foreground"}
            />
          </div>

          {/* Firebase status field, if present */}
          {packet.status && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/20 px-3 py-1.5 text-xs">
              <span className="text-muted-foreground font-medium">Firebase Status:</span>
              <span className="font-mono font-semibold text-foreground">{packet.status}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3.5">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Copy exact JSON format"
          >
            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
            <span>{copied ? "Copied JSON" : "Copy JSON Packet"}</span>
          </button>

          <div className="flex items-center gap-2">
            {onInjectGrid && packet.matchedGridCode && (
              <button
                onClick={() => {
                  onInjectGrid();
                  onClose();
                }}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-md hover:bg-emerald-600 transition-colors"
              >
                <Sparkles className="size-3.5" />
                <span>Inject into {packet.matchedGridCode}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SensorCard({
  icon: Icon,
  label,
  value,
  unit,
  color = "text-foreground",
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  unit: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-secondary/30 p-2.5 shadow-sm">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="text-[10px] font-medium truncate">{label}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`text-base font-bold tracking-tight ${color}`}>{value}</span>
        {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}
