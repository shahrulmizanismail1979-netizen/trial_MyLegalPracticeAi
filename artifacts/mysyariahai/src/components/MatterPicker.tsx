import { useState, useRef, useEffect } from "react";
import { useMatters, Matter } from "@/hooks/use-matters";
import { useLanguage } from "@/lib/language-context";
import { Button } from "@/components/ui/button";
import { FolderOpen, ChevronDown, X } from "lucide-react";

interface MatterPickerProps {
  onSelect: (matter: Matter) => void;
}

/**
 * Compact "Load from case file" dropdown that lists all matters and fires
 * onSelect(matter) when the user picks one.  Appears above AI tool forms.
 */
export function MatterPicker({ onSelect }: MatterPickerProps) {
  const { ts } = useLanguage();
  const { data: matters, isLoading } = useMatters();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Matter | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (matter: Matter) => {
    setSelected(matter);
    setOpen(false);
    onSelect(matter);
  };

  const handleClear = () => {
    setSelected(null);
  };

  const label = (m: Matter) => {
    const parts: string[] = [m.title];
    if (m.clientName) parts.push(m.clientName);
    if (m.caseNo) parts.push(m.caseNo);
    return parts.join(" · ");
  };

  return (
    <div
      ref={ref}
      className="relative flex items-center gap-2 p-2.5 mb-3 rounded-lg border border-secondary/25 bg-secondary/5"
    >
      <FolderOpen className="h-4 w-4 text-secondary shrink-0" />
      <span className="text-xs font-medium text-secondary mr-1 shrink-0">
        {ts("Load from case file", "Muatkan dari fail kes")}
      </span>

      {selected ? (
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <span className="text-xs text-foreground truncate flex-1">{label(selected)}</span>
          <button
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground shrink-0 p-0.5 rounded"
            title={ts("Clear", "Padam")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 border-secondary/30 text-secondary hover:bg-secondary/10 flex-1 justify-between"
          onClick={() => setOpen((o) => !o)}
          disabled={isLoading}
        >
          <span className="truncate">
            {isLoading
              ? ts("Loading…", "Memuatkan…")
              : matters && matters.length > 0
              ? ts("Select a matter…", "Pilih fail kes…")
              : ts("No matters yet", "Tiada fail kes")}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        </Button>
      )}

      {open && matters && matters.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-50 w-full min-w-[280px] max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          {matters.map((m) => (
            <button
              key={m.id}
              onClick={() => handleSelect(m)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors border-b border-border/40 last:border-b-0"
            >
              <span className="font-medium text-foreground block truncate">{m.title}</span>
              <span className="text-xs text-muted-foreground truncate block">
                {[m.clientName, m.caseNo].filter(Boolean).join(" · ")}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Build the formatted Syariah matter summary string.
 * Includes only non-empty fields.
 */
export function buildMatterSummary(m: Matter): string {
  const parts: string[] = [];
  if (m.title) parts.push(`Kes: ${m.title}`);
  if (m.clientName) parts.push(`Klien: ${m.clientName}`);
  if (m.plaintiff) parts.push(`Plaintif: ${m.plaintiff}`);
  if (m.defendant) parts.push(`Defendan: ${m.defendant}`);
  if (m.court) parts.push(`Mahkamah: ${m.court}`);
  if (m.caseNo) parts.push(`No. Kes: ${m.caseNo}`);
  if (m.matterType) parts.push(`Jenis: ${m.matterType}`);
  return parts.join(" | ");
}
