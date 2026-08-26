import { useState, useRef, useEffect } from "react";
import { FolderOpen, ChevronDown, X } from "lucide-react";
import { useMatters, Matter } from "@/hooks/use-matters";

interface MatterPickerProps {
  onSelect: (matter: Matter) => void;
  onClear?: () => void;
  resetKey?: number;
}

export function MatterPicker({ onSelect, onClear, resetKey }: MatterPickerProps) {
  const { data: matters, isLoading } = useMatters();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Matter | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (resetKey !== undefined) {
      setSelected(null);
      setOpen(false);
    }
  }, [resetKey]);

  function handleSelect(matter: Matter) {
    setSelected(matter);
    setOpen(false);
    onSelect(matter);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    setSelected(null);
    onClear?.();
  }

  function matterLabel(m: Matter): string {
    const parts: string[] = [m.title];
    if (m.clientName) parts.push(m.clientName);
    if (m.reference) parts.push(m.reference);
    return parts.join(" · ");
  }

  return (
    <div ref={ref} className="relative w-full">
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 cursor-pointer transition-colors text-sm select-none"
        onClick={() => setOpen((o) => !o)}
        role="button"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <FolderOpen className="w-4 h-4 text-primary shrink-0" />
        <span className="flex-1 min-w-0 truncate text-muted-foreground">
          {selected ? (
            <span className="text-foreground font-medium">{matterLabel(selected)}</span>
          ) : isLoading ? (
            "Loading case files…"
          ) : (
            "Load from case file…"
          )}
        </span>
        {selected ? (
          <X
            className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground shrink-0"
            onClick={handleClear}
            aria-label="Clear selection"
          />
        ) : (
          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </div>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-lg border border-border bg-card shadow-lg max-h-56 overflow-y-auto">
          {!matters || matters.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              No matters found. Create one in the Matters section.
            </div>
          ) : (
            <ul role="listbox">
              {matters.map((m) => (
                <li
                  key={m.id}
                  role="option"
                  aria-selected={selected?.id === m.id}
                  className="px-3 py-2.5 cursor-pointer hover:bg-accent/10 transition-colors border-b border-border/50 last:border-0"
                  onClick={() => handleSelect(m)}
                >
                  <div className="text-sm font-medium text-foreground truncate">{m.title}</div>
                  <div className="text-[11px] text-muted-foreground truncate mt-0.5 flex gap-1.5">
                    {m.clientName && <span>{m.clientName}</span>}
                    {m.clientName && m.reference && <span>·</span>}
                    {m.reference && <span>{m.reference}</span>}
                    {!m.clientName && !m.reference && <span className="italic">No client / ref</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
