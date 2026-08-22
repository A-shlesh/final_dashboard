import { useState, useRef, useEffect } from "react";
import { Search, MapPin, ChevronRight, X } from "lucide-react";
import { tierColor, tierOf, type LakeEntity } from "@/lib/water-data";

export function LakeSearchBar({
  lakes,
  selectedLake,
  onSelectLake,
}: {
  lakes: LakeEntity[];
  selectedLake: LakeEntity | null;
  onSelectLake: (lake: LakeEntity) => void;
}) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const filtered = query.trim()
    ? lakes.filter(
        (l) =>
          l.name.toLowerCase().includes(query.toLowerCase()) ||
          l.zone.toLowerCase().includes(query.toLowerCase()),
      )
    : [];

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
    <div ref={containerRef} className="relative w-[300px] max-w-[calc(100vw-2rem)]">
      <div className="flex items-center rounded-lg border border-border/80 bg-background/90 px-3 py-2 shadow-md backdrop-blur-md transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20">
        <Search className="mr-2 size-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsFocused(true);
          }}
          onFocus={() => setIsFocused(true)}
          placeholder="Search registered lakes..."
          className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
        />
        {query && (
          <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {isFocused && query.trim() && (
        <div className="absolute left-0 top-full z-[700] mt-1.5 max-h-64 w-full overflow-y-auto rounded-lg border border-border/80 bg-background/95 p-1 shadow-xl backdrop-blur-md">
          {filtered.length === 0 ? (
            <div className="p-3 text-center text-xs text-muted-foreground">
              No registered water body found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((lake) => {
              const active = selectedLake?.id === lake.id;
              return (
                <button
                  key={lake.id}
                  onClick={() => {
                    onSelectLake(lake);
                    setIsFocused(false);
                    setQuery("");
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition-colors ${
                    active ? "bg-accent text-accent-foreground font-semibold" : "hover:bg-accent/50 text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="size-3.5 shrink-0 text-primary" />
                    <div className="truncate">
                      <div className="font-medium truncate">{lake.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {lake.zone} Zone · {lake.areaHa} ha
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="size-3.5 text-muted-foreground shrink-0 ml-2" />
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
