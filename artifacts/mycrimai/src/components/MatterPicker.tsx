import { useState } from "react";
import { FolderOpen, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMatters, type Matter } from "@/hooks/use-matters";

interface MatterPickerProps {
  onSelect: (matter: Matter) => void;
}

export function MatterPicker({ onSelect }: MatterPickerProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Matter | null>(null);
  const { data: matters, isLoading } = useMatters();

  const handleSelect = (matter: Matter) => {
    setSelected(matter);
    onSelect(matter);
    setOpen(false);
  };

  if (!matters || matters.length === 0) return null;

  return (
    <div className="flex items-center gap-2 p-3 rounded-lg border border-border/50 bg-muted/20">
      <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <span className="text-sm text-muted-foreground flex-1">
        {selected
          ? <>Pre-filled from: <span className="font-medium text-foreground">{selected.title}</span></>
          : "Pre-fill from a case file"}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={isLoading}>
            📂 Load from case file
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[360px] p-0">
          <div className="p-2 border-b border-border/50">
            <p className="text-xs text-muted-foreground px-1">Select a matter to pre-fill the form</p>
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            {matters.map((matter) => (
              <button
                key={matter.id}
                type="button"
                onClick={() => handleSelect(matter)}
                className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-accent hover:text-accent-foreground transition-colors border-b border-border/30 last:border-0"
              >
                <Check
                  className={`h-4 w-4 mt-0.5 flex-shrink-0 ${selected?.id === matter.id ? "text-primary" : "text-transparent"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{matter.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[
                      matter.accusedName || matter.clientName,
                      matter.caseNo,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {matter.charge && (
                    <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{matter.charge}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Build a formatted case details string from a matter */
export function matterToCaseDetails(matter: Matter): string {
  const parts: string[] = [];
  if (matter.clientName) parts.push(`Client: ${matter.clientName}`);
  if (matter.accusedName) parts.push(`Accused: ${matter.accusedName}`);
  if (matter.charge) parts.push(`Charge: ${matter.charge}`);
  if (matter.court) parts.push(`Court: ${matter.court}`);
  if (matter.caseNo) parts.push(`Case No: ${matter.caseNo}`);
  if (matter.stage) parts.push(`Stage: ${matter.stage}`);
  return parts.join(" | ");
}

/** Build a short charge/court/caseNo reference string */
export function matterToChargeRef(matter: Matter): string {
  const parts: string[] = [];
  if (matter.charge) parts.push(matter.charge);
  if (matter.court) parts.push(matter.court);
  if (matter.caseNo) parts.push(`[${matter.caseNo}]`);
  return parts.join(" — ");
}
