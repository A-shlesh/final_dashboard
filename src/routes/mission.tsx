import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MissionPlanner } from "@/components/mission/mission-planner";
import { PiSettingsModal } from "@/components/live/pi-settings-modal";
import { useLiveTelemetry } from "@/hooks/use-live-telemetry";

export const Route = createFileRoute("/mission")({
  head: () => ({
    meta: [
      { title: "SCRUB // Mission Control" },
      { name: "description", content: "Live mission planning, waypoint management, and autonomous boat control." },
    ],
  }),
  component: MissionPage,
});

function MissionPage() {
  const [isPiSettingsOpen, setIsPiSettingsOpen] = useState(false);
  const { telemetry, dwellSample, connectionStatus, sendCommand } = useLiveTelemetry();

  return (
    <div className="dark flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <MissionPlanner
        telemetry={telemetry}
        dwellSample={dwellSample}
        connectionStatus={connectionStatus}
        sendCommand={sendCommand}
        onOpenSettings={() => setIsPiSettingsOpen(true)}
      />
      <PiSettingsModal isOpen={isPiSettingsOpen} onClose={() => setIsPiSettingsOpen(false)} />
    </div>
  );
}
