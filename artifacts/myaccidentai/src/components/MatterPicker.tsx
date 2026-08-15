import { useState, useRef, useEffect } from "react";
import { Folder, ChevronDown, X } from "lucide-react";
import { useMatters, type Matter } from "@/hooks/use-matters";

interface Props {
  onSelect: (matter: Matter) => void;
  selectedTitle?: string;
  onClear?: () => void;
}

export function MatterPicker({ onSelect, selectedTitle, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: matters, isLoading } = useMatters();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleSelect = (matter: Matter) => {
    onSelect(matter);
    setOpen(false);
  };

  const displayLabel = (m: Matter): string => {
    const parts: string[] = [m.title];
    const who = m.clientName || m.plaintiff;
    if (who) parts.push(who);
    if (m.caseNo) parts.push(m.caseNo);
    return parts.join(" · ");
  };

  return (
    <div ref={ref} className="relative inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border bg-muted/40 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        data-testid="button-load-matter"
      >
        <Folder className="h-3.5 w-3.5 flex-shrink-0" />
        {selectedTitle ? (
          <span className="max-w-[200px] truncate text-foreground font-medium">{selectedTitle}</span>
        ) : (
          <span>Load from case file</span>
        )}
        <ChevronDown className={`h-3 w-3 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {selectedTitle && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
          data-testid="button-clear-matter"
          title="Clear matter"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-80 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Select a matter to pre-fill
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {isLoading && (
              <p className="text-xs text-muted-foreground text-center py-4">Loading matters…</p>
            )}
            {!isLoading && (!matters || matters.length === 0) && (
              <p className="text-xs text-muted-foreground text-center py-4">No matters found.</p>
            )}
            {matters && matters.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleSelect(m)}
                data-testid={`matter-option-${m.id}`}
                className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors border-b border-border/40 last:border-0"
              >
                <div className="flex items-start gap-2">
                  <Folder className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{m.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {[m.clientName || m.plaintiff, m.caseNo || m.fileRef]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {m.matterType && (
                      <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded mt-1 inline-block">{m.matterType}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
