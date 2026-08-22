import { useState, useEffect } from "react";
import { Check, Cloud, Database, Flame, Globe, RefreshCw, Server, Wifi, X, MapPin } from "lucide-react";
import { getPiEndpoint, savePiEndpoint } from "@/lib/robot-telemetry-service";
import {
  getFirebaseConfig,
  saveFirebaseConfig,
  testFirebaseConnection,
  type FirebaseConfigState,
  type FirebaseTestResult,
} from "@/lib/firebase-telemetry-service";
import { useKeyboardArrowNav } from "@/lib/keyboard-nav";

export function PiSettingsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const containerRef = useKeyboardArrowNav<HTMLDivElement>(isOpen, onClose);
  const [activeTab, setActiveTab] = useState<"firebase" | "rpi">("firebase");

  // Raspberry Pi local gateway state
  const [piUrl, setPiUrl] = useState(getPiEndpoint());
  const [piTestStatus, setPiTestStatus] = useState<"idle" | "testing" | "success" | "failed">("idle");
  const [piTestMsg, setPiTestMsg] = useState("");

  // Firebase Cloud Gateway state
  const [fbConfig, setFbConfig] = useState<FirebaseConfigState>(getFirebaseConfig());
  const [fbTestStatus, setFbTestStatus] = useState<"idle" | "testing" | "success" | "failed">("idle");
  const [fbTestResult, setFbTestResult] = useState<FirebaseTestResult | null>(null);
  const [fbTestPayload, setFbTestPayload] = useState<any>(null);

  // Active gateway source ("firebase" | "rpi")
  const [gatewaySource, setGatewaySource] = useState<"firebase" | "rpi">(() => {
    return (localStorage.getItem("scrub_active_gateway_source") as "firebase" | "rpi") || "firebase";
  });

  useEffect(() => {
    if (isOpen) {
      setFbConfig(getFirebaseConfig());
      setPiUrl(getPiEndpoint());
      setGatewaySource((localStorage.getItem("scrub_active_gateway_source") as "firebase" | "rpi") || "firebase");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleTestPi() {
    setPiTestStatus("testing");
    setPiTestMsg("Connecting to Raspberry Pi...");

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(piUrl.trim(), { method: "GET", signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        setPiTestStatus("success");
        setPiTestMsg("Connected successfully! Local Raspberry Pi gateway online.");
      } else {
        setPiTestStatus("failed");
        setPiTestMsg(`Connected, but server returned HTTP ${res.status}`);
      }
    } catch (err: any) {
      setPiTestStatus("failed");
      setPiTestMsg(
        err.name === "AbortError"
          ? "Connection timed out. Check IP and network connection."
          : "Could not reach Raspberry Pi. Check if python bridge is running on port 5000.",
      );
    }
  }

  async function handleTestFirebase() {
    setFbTestStatus("testing");
    setFbTestResult(null);
    setFbTestPayload(null);

    try {
      const result = await testFirebaseConnection(fbConfig);
      setFbTestResult(result);
      setFbTestStatus(result.ok ? "success" : "failed");
      if (result.rawData) setFbTestPayload(result.rawData);
    } catch (err: any) {
      setFbTestResult({
        ok: false,
        message: `Firebase connection error: ${err?.message || String(err)}`,
        errorKind: "unknown",
      });
      setFbTestStatus("failed");
    }
  }

  function handleSave() {
    savePiEndpoint(piUrl.trim());
    saveFirebaseConfig(fbConfig);
    localStorage.setItem("scrub_active_gateway_source", gatewaySource);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        ref={containerRef}
        className="w-full max-w-lg rounded-2xl border border-border/80 bg-background/95 p-6 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Cloud className="size-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-foreground">
                Cloud & Hardware Telemetry Gateway
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Connect Firebase API & Raspberry Pi live streams
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Gateway Mode Switcher & Source Selector */}
        <div className="mt-3.5 flex items-center justify-between rounded-xl border border-border/60 bg-secondary/30 p-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveTab("firebase");
              setGatewaySource("firebase");
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${
              activeTab === "firebase"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Flame className="size-3.5 text-amber-400" />
            <span>Firebase Cloud Sync</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("rpi");
              setGatewaySource("rpi");
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${
              activeTab === "rpi"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Server className="size-3.5" />
            <span>Raspberry Pi Local</span>
          </button>
        </div>

        {/* Tab 1: Firebase Configuration */}
        {activeTab === "firebase" && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                Firebase Web API Key
              </label>
              <input
                type="text"
                value={fbConfig.apiKey}
                onChange={(e) => setFbConfig({ ...fbConfig, apiKey: e.target.value })}
                placeholder="Enter Firebase Web API Key"
                className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
              />
            </div>

            <div>
              <label className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                Firebase Database URL (or Project ID)
              </label>
              <input
                type="text"
                value={fbConfig.databaseURL}
                onChange={(e) => setFbConfig({ ...fbConfig, databaseURL: e.target.value })}
                placeholder="https://scrub-marine-default-rtdb.firebaseio.com"
                className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Telemetry Path / Node
                </label>
                <input
                  type="text"
                  value={fbConfig.telemetryPath}
                  onChange={(e) => setFbConfig({ ...fbConfig, telemetryPath: e.target.value })}
                  placeholder="telemetry or sensors"
                  className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Service Type
                </label>
                <select
                  value={fbConfig.serviceType}
                  onChange={(e) => setFbConfig({ ...fbConfig, serviceType: e.target.value as any })}
                  className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                >
                  <option value="rtdb">Realtime Database (RTDB)</option>
                  <option value="firestore">Firestore Collection</option>
                  <option value="rest">REST API / Polling</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-muted-foreground">
                Streams GPS & 5 sensor channels directly from Firebase to Map
              </span>
              <button
                type="button"
                onClick={handleTestFirebase}
                disabled={fbTestStatus === "testing"}
                className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50 transition-colors"
              >
                {fbTestStatus === "testing" ? (
                  <RefreshCw className="size-3.5 animate-spin" />
                ) : (
                  <Wifi className="size-3.5" />
                )}
                <span>Test Firebase</span>
              </button>
            </div>

            {fbTestResult && (
              <div
                className={`rounded-lg border p-2.5 text-xs font-medium whitespace-pre-wrap ${
                  fbTestStatus === "success"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                }`}
              >
                {fbTestResult.message}
              </div>
            )}

            {/* Raw Firebase node viewer */}
            {fbTestPayload && (
              <div className="rounded-lg border border-border/60 bg-secondary/20 p-2.5 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Live Firebase Node · {fbConfig.telemetryPath}
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                  {Object.entries(fbTestPayload).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between font-mono text-[10.5px]">
                      <span className="text-muted-foreground truncate">{k}</span>
                      <span className="text-foreground font-semibold ml-1">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Raspberry Pi Local Configuration */}
        {activeTab === "rpi" && (
          <div className="mt-4 space-y-3.5">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Raspberry Pi Telemetry URL
              </label>
              <div className="mt-1 flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={piUrl}
                    onChange={(e) => setPiUrl(e.target.value)}
                    placeholder="http://192.168.1.100:5000/telemetry"
                    className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleTestPi}
                  disabled={piTestStatus === "testing"}
                  className="flex items-center gap-1 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50 transition-colors"
                >
                  {piTestStatus === "testing" ? (
                    <RefreshCw className="size-3.5 animate-spin" />
                  ) : (
                    <Wifi className="size-3.5" />
                  )}
                  <span>Test</span>
                </button>
              </div>
              <p className="mt-1 text-[10.5px] text-muted-foreground">
                Tip: Run <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[10px] text-primary">python raspberry_pi_bridge.py</code> on your Pi.
              </p>
              <div className="mt-2 rounded-lg border border-border/60 bg-secondary/20 p-2 text-[10.5px] font-mono text-muted-foreground">
                <span className="text-foreground font-semibold">Video Stream Route:</span> {piUrl.replace("/telemetry", "/video_feed")}
              </div>
            </div>

            {piTestMsg && (
              <div
                className={`rounded-lg border p-2.5 text-xs font-medium ${
                  piTestStatus === "success"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-500"
                }`}
              >
                {piTestMsg}
              </div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3.5">
          <span className="text-[10px] font-mono text-muted-foreground">
            Active Source: <b className="text-foreground uppercase">{gatewaySource}</b>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
            >
              <Check className="size-3.5" />
              <span>Save & Connect</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
