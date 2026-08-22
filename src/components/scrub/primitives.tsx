import { cn } from "@/lib/utils";

export function Panel({
  title,
  right,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("panel-surface flex min-h-0 flex-col", className)}>
      <header className="flex h-8 shrink-0 items-center justify-between border-b border-panel-border bg-secondary/40 px-3">
        <h2 className="hud-label text-foreground/80">{title}</h2>
        {right}
      </header>
      <div className={cn("min-h-0 flex-1 overflow-auto", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Readout({
  label,
  value,
  unit,
  tone = "signal",
}: {
  label: string;
  value: string | number;
  unit?: string;
  tone?: "signal" | "caution" | "critical" | "data" | "muted";
}) {
  const toneClass = {
    signal: "text-signal",
    caution: "text-caution",
    critical: "text-critical",
    data: "text-data",
    muted: "text-muted-foreground",
  }[tone];
  return (
    <div className="flex flex-col gap-0.5">
      <span className="hud-label">{label}</span>
      <span className={cn("font-mono text-lg leading-none tabular-nums", toneClass)}>
        {value}
        {unit ? <span className="ml-1 text-[10px] text-muted-foreground">{unit}</span> : null}
      </span>
    </div>
  );
}

export function Bar({ value, tone = "signal" }: { value: number; tone?: "signal" | "caution" | "critical" }) {
  const bg = { signal: "bg-signal", caution: "bg-caution", critical: "bg-critical" }[tone];
  return (
    <div className="h-[3px] w-full bg-secondary">
      <div className={cn("h-full transition-[width] duration-300", bg)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
