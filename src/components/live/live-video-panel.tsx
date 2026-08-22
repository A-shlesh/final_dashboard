import { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  Maximize2,
  Minimize2,
  RefreshCw,
  Settings,
  Video,
  VideoOff,
  Wifi,
  X,
  Compass,
  Download,
  Activity,
  Layers,
  Sparkles,
} from "lucide-react";
import { getPiEndpoint, type HardwareTelemetryPacket } from "@/lib/robot-telemetry-service";

export function LiveVideoPanel({
  isOpen,
  onClose,
  telemetry,
  isStreaming,
  onOpenPiSettings,
}: {
  isOpen: boolean;
  onClose: () => void;
  telemetry: HardwareTelemetryPacket | null;
  isStreaming: boolean;
  onOpenPiSettings: () => void;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [streamStatus, setStreamStatus] = useState<"live" | "simulated" | "connecting" | "offline">("connecting");
  const [fps, setFps] = useState(30);
  const [snapshotNotice, setSnapshotNotice] = useState<string | null>(null);
  const [showHudOverlay, setShowHudOverlay] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const videoImgRef = useRef<HTMLImageElement | null>(null);

  // Compute video endpoint URL
  const piEndpoint = getPiEndpoint();
  const videoUrl = piEndpoint.replace("/telemetry", "/video_feed");

  // Handle stream connection & synthetic procedural fallback
  useEffect(() => {
    if (!isOpen || isMinimized) return;

    let isMounted = true;
    let waveOffset = 0;

    // Check if real video feed URL is accessible
    const testImg = new Image();
    testImg.src = videoUrl;
    testImg.onload = () => {
      if (isMounted) setStreamStatus("live");
    };
    testImg.onerror = () => {
      if (isMounted) setStreamStatus("simulated");
    };

    // Procedural Synthetic Marine Surface Simulation Loop
    function renderSimulationFrame() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      // 1. Water Surface Sky & Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.55);
      skyGrad.addColorStop(0, "#091522");
      skyGrad.addColorStop(0.6, "#0f2b3e");
      skyGrad.addColorStop(1, "#18455b");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h * 0.55);

      // Distant Shoreline Silhouette
      ctx.fillStyle = "#06131c";
      ctx.beginPath();
      ctx.moveTo(0, h * 0.52);
      for (let x = 0; x <= w; x += 20) {
        const treeH = Math.sin(x * 0.02) * 12 + Math.cos(x * 0.05) * 6;
        ctx.lineTo(x, h * 0.52 - treeH);
      }
      ctx.lineTo(w, h * 0.55);
      ctx.lineTo(0, h * 0.55);
      ctx.closePath();
      ctx.fill();

      // 2. Lake Water Body & Moving Waves
      const waterGrad = ctx.createLinearGradient(0, h * 0.55, 0, h);
      waterGrad.addColorStop(0, "#0d3142");
      waterGrad.addColorStop(0.5, "#08202d");
      waterGrad.addColorStop(1, "#030f16");
      ctx.fillStyle = waterGrad;
      ctx.fillRect(0, h * 0.55, w, h * 0.45);

      waveOffset += 0.035;

      // Render Dynamic Surface Ripple Waves
      for (let i = 0; i < 7; i++) {
        const yBase = h * (0.58 + i * 0.06);
        const amp = 3 + i * 2.2;
        const freq = 0.015 - i * 0.001;

        ctx.strokeStyle = `rgba(0, 229, 255, ${0.15 - i * 0.015})`;
        ctx.lineWidth = 1.5 + i * 0.4;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 10) {
          const y = yBase + Math.sin(x * freq + waveOffset + i) * amp;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // 3. Robot Bow Hull Perspective (SCRUB Robot POV)
      ctx.fillStyle = "#0c1824";
      ctx.beginPath();
      ctx.moveTo(w * 0.28, h);
      ctx.lineTo(w * 0.5, h * 0.74);
      ctx.lineTo(w * 0.72, h);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "#00e5ff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Robot Sensor Array Pod
      ctx.fillStyle = "#00e5ff";
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.74, 5, 0, Math.PI * 2);
      ctx.fill();

      // 4. Subtle Scanline FX
      ctx.fillStyle = "rgba(0, 229, 255, 0.03)";
      for (let y = 0; y < h; y += 4) {
        ctx.fillRect(0, y, w, 1);
      }

      animFrameRef.current = requestAnimationFrame(renderSimulationFrame);
    }

    renderSimulationFrame();

    return () => {
      isMounted = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, isMinimized, videoUrl]);

  // Snapshot Capture Feature
  const handleCaptureSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      const timeStr = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = dataUrl;
      a.download = `SCRUB_ROBOT_POV_${timeStr}.png`;
      a.click();

      setSnapshotNotice("Snapshot saved to downloads!");
      setTimeout(() => setSnapshotNotice(null), 3000);
    } catch (err) {
      console.warn("[scrub] snapshot capture error", err);
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed z-[850] transition-all duration-200 ${
        isFullscreen
          ? "inset-4 rounded-2xl"
          : isMinimized
          ? "bottom-4 right-4 w-72 h-12"
          : "bottom-4 right-4 w-[460px] max-w-[calc(100vw-2rem)] h-[320px]"
      } flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-background/95 shadow-2xl backdrop-blur-xl`}
    >
      {/* Video Window Top Header */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/70 bg-secondary/40 px-3.5">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Video className="size-3.5" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-display text-xs font-bold tracking-tight text-foreground">
              Robot Live Camera Feed
            </span>
            <span
              className={`rounded px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase tracking-wider ${
                streamStatus === "live"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : streamStatus === "simulated"
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                  : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
              }`}
            >
              {streamStatus === "live" ? "Live Stream" : streamStatus === "simulated" ? "Simulated POV" : "Connecting"}
            </span>
          </div>
        </div>

        {/* Control Actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowHudOverlay((prev) => !prev)}
            className={`rounded p-1.5 transition-colors ${
              showHudOverlay ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
            }`}
            title="Toggle Telemetry HUD Overlay"
          >
            <Layers className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={handleCaptureSnapshot}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Capture Screenshot PNG"
          >
            <Camera className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={onOpenPiSettings}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Configure RPi Video Feed URL"
          >
            <Settings className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
          >
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors ml-0.5"
            title="Close Video Feed"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Video Viewport & Canvas Area */}
      {!isMinimized && (
        <div className="relative flex-1 bg-black overflow-hidden select-none">
          {/* Real MJPEG Video Stream (if online) */}
          {streamStatus === "live" ? (
            <img
              ref={videoImgRef}
              src={videoUrl}
              alt="Live RPi Stream"
              className="absolute inset-0 h-full w-full object-cover"
              onError={() => setStreamStatus("simulated")}
            />
          ) : (
            <canvas
              ref={canvasRef}
              width={640}
              height={360}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}

          {/* HUD Telemetry Overlay */}
          {showHudOverlay && (
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
              {/* Top OSD Bar */}
              <div className="flex items-center justify-between text-[10px] font-mono text-cyan-400 drop-shadow-md">
                <div className="flex items-center gap-2 bg-black/60 px-2.5 py-1 rounded-md border border-cyan-400/30 backdrop-blur-sm">
                  <span className="size-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="font-bold uppercase tracking-wider text-white">REC · 1080P</span>
                  <span className="text-muted-foreground">|</span>
                  <span>{fps} FPS</span>
                </div>

                <div className="flex items-center gap-2 bg-black/60 px-2.5 py-1 rounded-md border border-cyan-400/30 backdrop-blur-sm">
                  <Compass className="size-3 text-cyan-400" />
                  <span>{telemetry ? telemetry.compass : 180}° N</span>
                  <span className="text-muted-foreground">|</span>
                  <span>LAT: {telemetry ? telemetry.gps.lat.toFixed(5) : "13.08270"}</span>
                  <span>LNG: {telemetry ? telemetry.gps.lng.toFixed(5) : "80.27070"}</span>
                </div>
              </div>

              {/* Center Crosshair & Pitch Ladder */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative flex items-center justify-center pointer-events-none opacity-40">
                  <div className="w-16 h-px bg-cyan-400" />
                  <div className="size-6 rounded-full border border-cyan-400" />
                  <div className="w-16 h-px bg-cyan-400" />
                  <div className="absolute h-8 w-px bg-cyan-400 -top-4" />
                </div>
              </div>

              {/* Bottom Sensor Telemetry OSD Banner */}
              <div className="flex items-center justify-between bg-black/75 px-3 py-1.5 rounded-lg border border-cyan-400/30 backdrop-blur-md text-[10px] font-mono text-foreground">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="text-muted-foreground text-[9px] block">TDS</span>
                    <span className="font-bold text-cyan-400">
                      {telemetry ? `${telemetry.sensors.tds} ppm` : "412.5 ppm"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[9px] block">TURBIDITY</span>
                    <span className="font-bold text-emerald-400">
                      {telemetry ? `${telemetry.sensors.turbidity} NTU` : "18.2 NTU"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[9px] block">PH</span>
                    <span className="font-bold text-white">
                      {telemetry ? `${telemetry.sensors.ph}` : "7.34"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[9px] block">AIR TEMP</span>
                    <span className="font-bold text-amber-400">
                      {telemetry ? `${telemetry.sensors.air_temperature}°C` : "31.4°C"}
                    </span>
                  </div>
                </div>

                <div className="text-right text-[9.5px] text-muted-foreground">
                  <div>SCRUB-R100 POV</div>
                  <div className="text-[8.5px] text-emerald-400">
                    {isStreaming ? "0.5 Hz SYNC ACTIVE" : "STANDBY"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Snapshot Notice Toast */}
          {snapshotNotice && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/95 px-4 py-1.5 text-xs font-bold text-white shadow-2xl backdrop-blur-md animate-in zoom-in-95">
              {snapshotNotice}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
