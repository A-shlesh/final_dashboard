import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { FileDown, FileText, ShieldCheck } from "lucide-react";
import { EXTRACTION_SERIES, LAKES, QUALITY_DELTA } from "@/lib/scrub-data";
import { Panel } from "./primitives";

const axis = { stroke: "var(--muted-foreground)", fontSize: 9, fontFamily: "var(--font-data)" };

export function CompliancePanel() {
  const [generated, setGenerated] = useState<string | null>(null);
  const totalKg = LAKES.reduce((s, l) => s + l.extractedKg, 0);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-auto p-2 lg:grid-cols-3">
      <Panel title="Compliance Summary // FY 25-26" className="lg:col-span-2" bodyClassName="p-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Total Extracted" value={totalKg.toLocaleString()} unit="kg" />
          <Kpi label="Water Quality Delta" value="+21.4" unit="% DO" />
          <Kpi label="Sectors Reclaimed" value="418" unit="/ 1152" />
          <Kpi label="Compliance Score" value="92.6" unit="CPCB" />
        </div>
        <div className="mt-4 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={EXTRACTION_SERIES} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="var(--panel-border)" strokeDasharray="2 3" vertical={false} />
              <XAxis dataKey="m" tick={axis} tickLine={false} axisLine={{ stroke: "var(--panel-border)" }} />
              <YAxis tick={axis} tickLine={false} axisLine={false} width={40} />
              <Bar dataKey="kg" fill="var(--signal)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <table className="mt-4 w-full font-mono text-[10px]">
          <thead>
            <tr className="border-b border-panel-border text-muted-foreground">
              <th className="py-1 text-left font-normal tracking-widest">WATER BODY</th>
              <th className="py-1 text-left font-normal tracking-widest">WARD</th>
              <th className="py-1 text-right font-normal tracking-widest">AREA (HA)</th>
              <th className="py-1 text-right font-normal tracking-widest">EXTRACTED (KG)</th>
              <th className="py-1 text-right font-normal tracking-widest">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {LAKES.map((l) => (
              <tr key={l.id} className="border-b border-panel-border/50">
                <td className="py-1 text-foreground/90">{l.name}</td>
                <td className="py-1 text-muted-foreground">{l.ward}</td>
                <td className="py-1 text-right text-muted-foreground">{l.areaHa.toFixed(1)}</td>
                <td className="py-1 text-right text-data">{l.extractedKg.toLocaleString()}</td>
                <td className="py-1 text-right uppercase text-foreground/70">{l.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <div className="flex min-h-0 flex-col gap-2">
        <Panel title="Report Engine" bodyClassName="p-3 space-y-2">
          {[
            { icon: FileText, label: "BBMP Monthly Compliance", meta: "PDF · 14 pages · auto-compiled" },
            { icon: ShieldCheck, label: "CSR Impact Statement", meta: "PDF · branded · sponsor-ready" },
            { icon: FileDown, label: "Anomaly Log Export", meta: "CSV · regulator schema (KSPCB)" },
          ].map((r) => (
            <button
              key={r.label}
              onClick={() => setGenerated(r.label)}
              className="flex w-full items-center gap-3 border border-panel-border bg-secondary/40 p-2 text-left transition-colors hover:border-signal hover:bg-secondary"
            >
              <r.icon className="size-4 text-signal" />
              <span className="flex-1">
                <span className="block font-mono text-[11px] text-foreground">{r.label}</span>
                <span className="block font-mono text-[9px] text-muted-foreground">{r.meta}</span>
              </span>
              <span className="hud-label">GEN</span>
            </button>
          ))}
          {generated && (
            <p className="border border-signal/40 bg-signal/10 p-2 font-mono text-[10px] text-signal">
              QUEUED — “{generated}” compiling from 1,152 sector records. Delivery to registered recipients on completion.
            </p>
          )}
        </Panel>

        <Panel title="Quality Delta Ledger" bodyClassName="p-2">
          <table className="w-full font-mono text-[10px]">
            <tbody>
              {QUALITY_DELTA.map((q) => (
                <tr key={q.m} className="border-b border-panel-border/50 last:border-0">
                  <td className="py-1 text-muted-foreground">{q.m}</td>
                  <td className="py-1 text-right text-caution">pH {q.ph}</td>
                  <td className="py-1 text-right text-signal">DO {q.do}</td>
                  <td className="py-1 text-right text-data">{q.ntu} NTU</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}

function Kpi({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="border border-panel-border bg-secondary/30 p-2">
      <div className="hud-label">{label}</div>
      <div className="font-mono text-2xl leading-tight text-signal text-glow tabular-nums">{value}</div>
      <div className="font-mono text-[9px] text-muted-foreground">{unit}</div>
    </div>
  );
}
