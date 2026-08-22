import { AlertTriangle, Download, X } from "lucide-react";

export function AlertBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-critical/60 bg-critical/12 px-4 py-1.5">
      <AlertTriangle className="size-4 animate-blink text-critical" />
      <span className="font-mono text-[11px] uppercase tracking-widest text-critical">
        Biochemical Anomaly — KEN-D7 · 12.9145 N / 77.4820 E · 06:41:07Z
      </span>
      <span className="font-mono text-[11px] text-foreground/85">
        pH 7.4 → 5.1 &nbsp;|&nbsp; TDS +840 ppm &nbsp;|&nbsp; signature consistent with untreated effluent discharge
      </span>
      <div className="ml-auto flex items-center gap-2">
        <button className="flex items-center gap-1.5 border border-critical/70 bg-critical/20 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-critical transition-colors hover:bg-critical/30">
          <Download className="size-3" /> Export anomaly log
        </button>
        <button onClick={onDismiss} aria-label="Acknowledge alert" className="text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
