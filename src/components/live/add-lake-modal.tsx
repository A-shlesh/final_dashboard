import { useState } from "react";
import { MapPin, Plus, Waves, X } from "lucide-react";
import { ZONES, strHash, type LakeEntity } from "@/lib/water-data";

export function AddLakeModal({
  isOpen,
  onClose,
  onAddLake,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAddLake: (newLake: LakeEntity) => void;
}) {
  const [name, setName] = useState("");
  const [zone, setZone] = useState(ZONES[0] ?? "West");
  const [areaHa, setAreaHa] = useState("25");
  const [lat, setLat] = useState("12.9250");
  const [lng, setLng] = useState("77.5850");

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const parsedLat = parseFloat(lat) || 12.9716;
    const parsedLng = parseFloat(lng) || 77.5946;
    const parsedArea = parseFloat(areaHa) || 20;

    const id = `custom-lake-${strHash(name + Date.now())}`;

    const newLake: LakeEntity = {
      id,
      name: name.trim(),
      zone,
      lat: parsedLat,
      lng: parsedLng,
      areaHa: parsedArea,
      coveragePct: 0,
      boundary: [],
      startPoint: [+(parsedLng - 0.002).toFixed(6), +(parsedLat - 0.002).toFixed(6)],
      boundaryLocked: false, // unlocked so user can edit boundary
      lastDeployment: new Date().toISOString(),
      robotUnit: `SCRUB-RX${(strHash(id) % 90) + 10}`,
    };

    onAddLake(newLake);
    setName("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border/80 bg-background p-6 shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Waves className="size-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-foreground">
                Register New Water Body
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Add a lake or water body to Bengaluru Basin
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Water Body Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Halagevader Halli Lake"
              className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Zone / Region
              </label>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
              >
                {ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z} Zone
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Surface Area (ha)
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                value={areaHa}
                onChange={(e) => setAreaHa(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Center Latitude
              </label>
              <input
                type="text"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="mt-1 w-full font-mono text-xs rounded-lg border border-border bg-secondary/30 px-3 py-2 text-foreground outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Center Longitude
              </label>
              <input
                type="text"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="mt-1 w-full font-mono text-xs rounded-lg border border-border bg-secondary/30 px-3 py-2 text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-border/60 pt-3.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Plus className="size-3.5" />
              <span>Add & Survey Lake</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
