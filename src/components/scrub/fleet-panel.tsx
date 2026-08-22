import { Battery, CircuitBoard, Gauge, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { FLEET } from "@/lib/scrub-data";
import { Panel } from "./primitives";

const stateTone: Record<string, string> = {
  SWEEPING: "text-signal",
  TRANSIT: "text-data",
  DOCKED: "text-muted-foreground",
  FAULT: "text-critical animate-blink",
};

export function FleetPanel() {
  return (
    <Panel title="Fleet Health" right={<span className="font-mono text-[10px] text-muted-foreground">4 UNITS</span>} bodyClassName="divide-y divide-panel-border/60">
      {FLEET.map((b) => (
        <article key={b.id} className="p-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-foreground">{b.name}</span>
            <span className={cn("font-mono text-[9px] tracking-widest", stateTone[b.state])}>{b.state}</span>
          </div>
          <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">ASSIGNED · {b.lake.toUpperCase()}</div>
          <div className="mt-2 grid grid-cols-4 gap-2 font-mono text-[10px]">
            <Stat icon={<Battery className="size-3" />} v={`${b.battery}%`} tone={b.battery < 20 ? "text-critical" : "text-signal"} />
            <Stat icon={<CircuitBoard className="size-3" />} v={`${b.voltage}V`} tone={b.voltage < 22 ? "text-critical" : "text-data"} />
            <Stat icon={<Gauge className="size-3" />} v={`${b.rpm}`} tone="text-foreground/80" />
            <Stat icon={<Package className="size-3" />} v={`${b.hopper}%`} tone={b.hopper > 85 ? "text-caution" : "text-foreground/80"} />
          </div>
          <div className="mt-2 h-[3px] w-full bg-secondary">
            <div className={cn("h-full", b.battery < 20 ? "bg-critical" : "bg-signal")} style={{ width: `${b.battery}%` }} />
          </div>
        </article>
      ))}
    </Panel>
  );
}

function Stat({ icon, v, tone }: { icon: React.ReactNode; v: string; tone: string }) {
  return (
    <div className={cn("flex items-center gap-1", tone)}>
      {icon}
      <span className="tabular-nums">{v}</span>
    </div>
  );
}
