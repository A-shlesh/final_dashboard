import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertBanner } from "@/components/scrub/alert-banner";
import { AnalyticsPanel } from "@/components/scrub/analytics-panel";
import { CompliancePanel } from "@/components/scrub/compliance-panel";
import { FleetPanel } from "@/components/scrub/fleet-panel";
import { MapViewport, type LayerKey } from "@/components/scrub/map-viewport";
import { TelemetryPanel } from "@/components/scrub/telemetry-panel";
import { TopBar, type ActiveMainView } from "@/components/scrub/top-bar";
import { KengeriMonitoringSuite } from "@/components/combined/kengeri-monitoring-suite";
import { LAKES, type Cell, type Lake } from "@/lib/scrub-data";

export const Route = createFileRoute("/ops")({
  head: () => ({
    meta: [
      { title: "SCRUB // Command Center — Marine Reclamation Ops & Live Telemetry" },
      {
        name: "description",
        content:
          "Unified mission control and live IoT monitoring dashboard for Project SCRUB: real-time 8-sensor telemetry (MQ-135, Turbidity, pH, TDS, DHT, GPS/Compass), IS:10500 WQI calculations, pollution source triangulation, Pearson correlation matrix, and autonomous fleet swarm operations across Bengaluru lakes.",
      },
      { property: "og:title", content: "SCRUB // Command Center" },
      {
        property: "og:description",
        content:
          "Real-time grid telemetry, 8-channel IoT monitoring, predictive bloom tracking, and swarm routing for autonomous water reclamation robots.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MissionControl,
});

function MissionControl() {
  const [layers, setLayers] = useState<Set<LayerKey>>(new Set<LayerKey>(["standard", "fleet"]));
  const [selected, setSelected] = useState<Lake | null>(null);
  const [cell, setCell] = useState<Cell | null>(null);
  const [view, setView] = useState<ActiveMainView>("kengeri"); // Default to comprehensive Kengeri Live Robot suite
  const [alert, setAlert] = useState(true);
  const [clock, setClock] = useState("--:--:--");

  useEffect(() => {
    const tick = () => setClock(new Date().toISOString().slice(11, 19));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, []);

  const toggle = (k: LayerKey) =>
    setLayers((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const showFleet = layers.has("fleet");
  const statusLine = useMemo(
    () =>
      `TRACKED ${LAKES.length} BODIES · ACTIVE ${LAKES.filter((l) => l.status === "active").length} · RECLAIMED ${
        LAKES.filter((l) => l.status === "cleaned").length
      }`,
    [],
  );

  return (
    <div className="dark flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <TopBar layers={layers} onToggle={toggle} view={view} onView={setView} clock={clock} />
      {alert && <AlertBanner onDismiss={() => setAlert(false)} />}

      {view === "kengeri" ? (
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <KengeriMonitoringSuite />
        </main>
      ) : view === "ops" ? (
        <main className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-auto p-2 xl:grid-cols-[320px_minmax(0,1fr)_320px] xl:overflow-hidden">
          <div className="min-h-0 overflow-auto xl:pr-0.5">
            <AnalyticsPanel />
          </div>

          <div className="flex min-h-[520px] flex-col gap-2">
            <MapViewport layers={layers} selected={selected} onSelect={setSelected} onHoverCell={setCell} activeCell={cell} />
          </div>

          <div className="flex min-h-0 flex-col gap-2 overflow-auto">
            <TelemetryPanel cell={cell} />
            {showFleet && <FleetPanel />}
          </div>
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <CompliancePanel />
        </main>
      )}

      <footer className="flex shrink-0 items-center justify-between border-t border-panel-border bg-panel px-4 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>{statusLine}</span>
        <span className="hidden sm:block">
          {view === "kengeri" ? "TARGET KENGERI LAKE // SENSORS: MQ-135, TURB, PH, TDS, DHT, GPS" : selected ? `TARGET ${selected.name.toUpperCase()} · ${selected.ward.toUpperCase()}` : "NO TARGET LOCK"}
        </span>
        <span className="text-signal">TELEMETRY BUS ● NOMINAL</span>
      </footer>
    </div>
  );
}
