import { useState, useRef, useEffect, useCallback } from "react";
import { Search, MapPin, Loader2, X, Building, Navigation } from "lucide-react";
import type { LakeEntity } from "@/lib/water-data";

export interface GeoSearchResult {
  id: string;
  name: string;
  subtext: string;
  lat: number;
  lng: number;
  type: "area" | "lake" | "landmark";
  lakeEntity?: LakeEntity;
}

// Common fast Bengaluru area presets for instant responsiveness
const LOCAL_AREA_PRESETS: GeoSearchResult[] = [
  { id: "blr-koramangala", name: "Koramangala", subtext: "Bengaluru, Karnataka", lat: 12.9352, lng: 77.6245, type: "area" },
  { id: "blr-indiranagar", name: "Indiranagar", subtext: "Bengaluru, Karnataka", lat: 12.9784, lng: 77.6408, type: "area" },
  { id: "blr-whitefield", name: "Whitefield", subtext: "Bengaluru, Karnataka", lat: 12.9698, lng: 77.7500, type: "area" },
  { id: "blr-jayanagar", name: "Jayanagar", subtext: "Bengaluru, Karnataka", lat: 12.9308, lng: 77.5838, type: "area" },
  { id: "blr-hsr", name: "HSR Layout", subtext: "Bengaluru, Karnataka", lat: 12.9121, lng: 77.6446, type: "area" },
  { id: "blr-hebbal", name: "Hebbal", subtext: "Bengaluru, Karnataka", lat: 13.0358, lng: 77.5970, type: "area" },
  { id: "blr-bellandur", name: "Bellandur", subtext: "Bengaluru, Karnataka", lat: 12.9260, lng: 77.6762, type: "area" },
  { id: "blr-ulsoor", name: "Ulsoor", subtext: "Bengaluru, Karnataka", lat: 12.9815, lng: 77.6180, type: "area" },
  { id: "blr-mgroad", name: "MG Road / Central", subtext: "Bengaluru, Karnataka", lat: 12.9756, lng: 77.6066, type: "area" },
  { id: "blr-electronic-city", name: "Electronic City", subtext: "Bengaluru, Karnataka", lat: 12.8399, lng: 77.6770, type: "area" },
  { id: "blr-kengeri", name: "Kengeri", subtext: "Bengaluru, Karnataka", lat: 12.9081, lng: 77.4852, type: "area" },
  { id: "blr-malleshwaram", name: "Malleshwaram", subtext: "Bengaluru, Karnataka", lat: 13.0031, lng: 77.5643, type: "area" },
  { id: "blr-jp-nagar", name: "JP Nagar", subtext: "Bengaluru, Karnataka", lat: 12.9063, lng: 77.5857, type: "area" },
  { id: "blr-banashankari", name: "Banashankari", subtext: "Bengaluru, Karnataka", lat: 12.9255, lng: 77.5468, type: "area" },
  { id: "blr-rajajinagar", name: "Rajajinagar", subtext: "Bengaluru, Karnataka", lat: 12.9982, lng: 77.5530, type: "area" },
  { id: "blr-yelahanka", name: "Yelahanka", subtext: "Bengaluru, Karnataka", lat: 13.1007, lng: 77.5963, type: "area" },
];

export function LocationSearchBar({
  lakes,
  onNavigateToLocation,
  onSelectLake,
}: {
  lakes: LakeEntity[];
  onNavigateToLocation: (lng: number, lat: number, zoom?: number) => void;
  onSelectLake: (lake: LakeEntity) => void;
}) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<GeoSearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounced search query
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setSelectedIndex(0);

    const timer = setTimeout(async () => {
      // 1. Check matching registered lakes
      const matchedLakes: GeoSearchResult[] = lakes
        .filter(
          (l) =>
            l.name.toLowerCase().includes(q) ||
            l.zone.toLowerCase().includes(q),
        )
        .map((l) => ({
          id: `lake-${l.id}`,
          name: l.name,
          subtext: `Registered Water Body · ${l.zone} Zone (${l.areaHa} ha)`,
          lat: l.lat,
          lng: l.lng,
          type: "lake" as const,
          lakeEntity: l,
        }));

      // 2. Check local quick area presets
      const matchedPresets: GeoSearchResult[] = LOCAL_AREA_PRESETS.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.subtext.toLowerCase().includes(q),
      );

      // 3. Query OpenStreetMap Nominatim for live global/city location geocoding
      let osmResults: GeoSearchResult[] = [];
      try {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            q + (q.includes("bengaluru") || q.includes("bangalore") ? "" : " Bengaluru"),
          )}&format=json&addressdetails=1&limit=5`,
          { signal: controller.signal },
        );

        if (res.ok) {
          const data = await res.json();
          osmResults = (data || []).map((item: any) => ({
            id: `osm-${item.place_id}`,
            name: item.name || item.display_name.split(",")[0],
            subtext: item.display_name.split(",").slice(1, 4).join(",").trim(),
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            type: "area" as const,
          }));
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.warn("[scrub] geocoding query error", err);
        }
      }

      // Merge and deduplicate by proximity
      const combined = [...matchedLakes, ...matchedPresets, ...osmResults];
      const seen = new Set<string>();
      const deduplicated: GeoSearchResult[] = [];

      for (const item of combined) {
        const key = `${item.name.toLowerCase()}-${item.lat.toFixed(3)}-${item.lng.toFixed(3)}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduplicated.push(item);
        }
      }

      setResults(deduplicated.slice(0, 8));
      setIsLoading(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [query, lakes]);

  const handleSelect = useCallback(
    (item: GeoSearchResult) => {
      if (item.type === "lake" && item.lakeEntity) {
        onSelectLake(item.lakeEntity);
      } else {
        onNavigateToLocation(item.lng, item.lat, 15.0);
      }
      setIsFocused(false);
      setQuery(item.name);
    },
    [onNavigateToLocation, onSelectLake],
  );

  // Keyboard arrow navigation
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!results.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]!);
      }
    } else if (e.key === "Escape") {
      setIsFocused(false);
    }
  }

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-[320px] max-w-[calc(100vw-2rem)]">
      <div className="flex h-9 items-center rounded-lg border border-border/80 bg-background/90 px-3 shadow-sm backdrop-blur-md transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20">
        <Search className="mr-2 size-3.5 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsFocused(true);
          }}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search any area, locality, or lake..."
          className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
        />

        {isLoading && (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground ml-1.5 shrink-0" />
        )}

        {query && !isLoading && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
            }}
            className="text-muted-foreground hover:text-foreground ml-1.5"
            title="Clear search"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isFocused && (query.trim().length > 0 || results.length > 0) && (
        <div className="absolute left-0 top-full z-[700] mt-1.5 max-h-72 w-full overflow-y-auto rounded-xl border border-border/80 bg-background/95 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95">
          {results.length === 0 && !isLoading ? (
            <div className="p-3 text-center text-xs text-muted-foreground">
              No matching areas or lakes found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            results.map((item, index) => {
              const active = index === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                      : "text-foreground hover:bg-accent/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`flex size-6 shrink-0 items-center justify-center rounded-md ${
                        item.type === "lake"
                          ? active
                            ? "bg-white/20 text-white"
                            : "bg-cyan-500/10 text-cyan-400"
                          : active
                          ? "bg-white/20 text-white"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {item.type === "lake" ? (
                        <Navigation className="size-3" />
                      ) : (
                        <Building className="size-3" />
                      )}
                    </div>

                    <div className="truncate">
                      <div className="font-bold truncate">{item.name}</div>
                      <div
                        className={`text-[10px] truncate ${
                          active ? "text-primary-foreground/80" : "text-muted-foreground"
                        }`}
                      >
                        {item.subtext}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`ml-2 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider ${
                      item.type === "lake"
                        ? active
                          ? "bg-white/20 text-white"
                          : "bg-primary/10 text-primary border border-primary/20"
                        : active
                        ? "bg-white/20 text-white"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {item.type === "lake" ? "Lake" : "Area"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
