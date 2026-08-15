import { useState } from "react";
import { FolderOpen, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMatters, Matter } from "@/hooks/use-matters";

interface MatterPickerProps {
  onSelect: (matter: Matter) => void;
}

export function MatterPicker({ onSelect }: MatterPickerProps) {
  const { data: matters, isLoading } = useMatters();
  const [open, setOpen] = useState(false);
  const [selectedMatter, setSelectedMatter] = useState<Matter | null>(null);

  const handleSelect = (matter: Matter) => {
    setSelectedMatter(matter);
    setOpen(false);
    onSelect(matter);
  };

  const handleClear = () => {
    setSelectedMatter(null);
  };

  const matterLabel = (m: Matter) => {
    const parts: string[] = [m.title];
    if (m.clientName) parts.push(m.clientName);
    if (m.reference) parts.push(m.reference);
    return parts.join(" · ");
  };

  return (
    <div className="relative mb-4">
      <div className="flex items-center gap-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
        <FolderOpen className="h-4 w-4 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {selectedMatter ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground truncate">
                {matterLabel(selectedMatter)}
              </span>
              <button
                type="button"
                onClick={handleClear}
                className="ml-auto flex-shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Clear selection"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">No case file selected</span>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          disabled={isLoading}
          className="flex-shrink-0 h-7 text-xs border-primary/30 text-primary hover:bg-primary/10 gap-1"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          {selectedMatter ? "Change" : "Load from case file"}
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>
      </div>

      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
          {isLoading ? (
            <div className="p-3 text-sm text-muted-foreground">Loading matters…</div>
          ) : !matters || matters.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">No case files found.</div>
          ) : (
            <ul className="max-h-60 overflow-y-auto divide-y divide-border">
              {matters.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2.5 hover:bg-muted/60 transition-colors"
                    onClick={() => handleSelect(m)}
                  >
                    <div className="text-sm font-medium text-foreground leading-tight truncate">
                      {m.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex gap-2 flex-wrap">
                      {m.clientName && <span>{m.clientName}</span>}
                      {m.reference && <span className="font-mono">{m.reference}</span>}
                      {m.matterType && <span className="italic">{m.matterType}</span>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Maps a selected matter's fields into form values keyed by field name/label.
 * Called in tool.tsx to pre-fill the dynamic form.
 */
export function mapMatterToFormValues(
  matter: Matter,
  fields: Array<{ name: string; label: string; type: string }>,
): Record<string, string> {
  const summary = buildSummary(matter);
  const parties = buildParties(matter);

  const result: Record<string, string> = {};
  let firstTextarea: string | null = null;
  let summaryFilled = false;

  for (const field of fields) {
    const key = (field.name + " " + field.label).toLowerCase();

    if (firstTextarea === null && field.type === "textarea") {
      firstTextarea = field.name;
    }

    if (/case.?details|facts|background|case.?summary/.test(key)) {
      result[field.name] = summary;
      summaryFilled = true;
    } else if (/\bparties\b|claimant|plaintiff|defendant/.test(key)) {
      result[field.name] = parties;
    } else if (/\breference\b|file.?ref|suit.?no|case.?no/.test(key)) {
      result[field.name] = matter.reference ?? "";
    }
  }

  // Fallback: put summary into first textarea if nothing matched
  if (!summaryFilled && firstTextarea !== null && !result[firstTextarea]) {
    result[firstTextarea] = summary;
  }

  return result;
}

function buildSummary(m: Matter): string {
  const parts: string[] = [];
  if (m.clientName) parts.push(`Client: ${m.clientName}`);
  if (m.counterparty) parts.push(`Counterparty: ${m.counterparty}`);
  if (m.title) parts.push(`Matter: ${m.title}`);
  if (m.matterType) parts.push(`Type: ${m.matterType}`);
  if (m.reference) parts.push(`Ref: ${m.reference}`);
  return parts.join(" | ");
}

function buildParties(m: Matter): string {
  if (m.clientName && m.counterparty) {
    return `${m.clientName} vs ${m.counterparty}`;
  }
  return m.clientName ?? "";
}
