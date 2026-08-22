import { AlertTriangle, Trash2, X } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import type { LakeEntity } from "@/lib/water-data";

export function ClearLakeModal({
  lake,
  isOpen,
  onClose,
  onConfirm,
}: {
  lake: LakeEntity | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (lakeId: string) => void;
}) {
  const [selectedAction, setSelectedAction] = useState<"cancel" | "delete">("cancel");
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);
  const deleteBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedAction("cancel");
      setTimeout(() => cancelBtnRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global Keyboard listener for arrow keys, Enter, and Escape
  useEffect(() => {
    if (!isOpen || !lake) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "Tab") {
        e.preventDefault();
        setSelectedAction((prev) => (prev === "cancel" ? "delete" : "cancel"));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedAction((prev) => (prev === "delete" ? "cancel" : "delete"));
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (selectedAction === "delete" && lake) {
          onConfirm(lake.id);
          onClose();
        } else {
          onClose();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, lake, selectedAction, onClose, onConfirm]);

  if (!isOpen || !lake) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-destructive/40 bg-background p-6 shadow-2xl animate-in fade-in zoom-in-95">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-foreground">Delete Lake?</h3>
              <p className="text-xs text-muted-foreground">Permanent deletion of registered water body</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none"
            title="Close (Esc)"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Simplified Direct Confirmation Message */}
        <div className="my-5 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-xs leading-relaxed text-foreground">
          This lake (<strong className="font-bold text-destructive">{lake.name}</strong>) will be completely deleted from the observatory.
        </div>

        {/* Action Buttons with Keyboard Arrow Key Highlights */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onClose}
            onMouseEnter={() => setSelectedAction("cancel")}
            className={`rounded-lg border px-5 py-2.5 text-xs font-bold transition-all duration-150 ${
              selectedAction === "cancel"
                ? "border-primary bg-secondary text-foreground ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg scale-105"
                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            Cancel
          </button>

          <button
            ref={deleteBtnRef}
            type="button"
            onClick={() => {
              onConfirm(lake.id);
              onClose();
            }}
            onMouseEnter={() => setSelectedAction("delete")}
            className={`flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-xs font-bold transition-all duration-150 ${
              selectedAction === "delete"
                ? "bg-destructive text-destructive-foreground ring-2 ring-destructive ring-offset-2 ring-offset-background shadow-xl scale-105"
                : "bg-destructive/80 text-destructive-foreground hover:bg-destructive"
            }`}
          >
            <Trash2 className="size-3.5" />
            Delete Lake
          </button>
        </div>

        <div className="mt-3 text-center text-[10px] text-muted-foreground font-mono">
          Use <kbd className="rounded bg-muted px-1.5 py-0.5 border border-border">←</kbd> <kbd className="rounded bg-muted px-1.5 py-0.5 border border-border">→</kbd> arrow keys to switch, <kbd className="rounded bg-muted px-1.5 py-0.5 border border-border">Enter</kbd> to select
        </div>
      </div>
    </div>
  );
}
