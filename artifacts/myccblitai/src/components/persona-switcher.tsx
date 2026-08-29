import { useState } from "react";
import {
  usePersona,
  PERSONA_ROLES,
  PERSONA_LABELS,
  PERSONA_DESCRIPTIONS,
  type PersonaRole,
} from "@workspace/persona-client";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { UserCog, Check } from "lucide-react";

export default function PersonaSwitcher() {
  const { role, code, saving, switchRole } = usePersona();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const handleSelect = async (next: PersonaRole) => {
    try {
      await switchRole(next);
      toast({
        title: "Professional mode updated",
        description: `Now tailored for ${PERSONA_LABELS[next]}.`,
      });
      setOpen(false);
    } catch (e) {
      toast({
        title: "Couldn't update mode",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          data-testid="button-persona-switcher"
        >
          <UserCog className="h-4 w-4" />
          {role ? PERSONA_LABELS[role] : "Professional mode"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Professional mode</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tailor the workspace to how you practise.
          </p>
        </div>
        {code === null ? (
          <div className="px-4 py-4 text-sm text-muted-foreground" data-testid="text-persona-hint">
            Log in again with your access code to enable switching.
          </div>
        ) : (
          <div className="py-1 max-h-80 overflow-y-auto">
            {PERSONA_ROLES.map((r) => {
              const active = r === role;
              return (
                <button
                  key={r}
                  type="button"
                  disabled={saving}
                  onClick={() => handleSelect(r)}
                  className={`w-full text-left px-4 py-2.5 transition-colors flex items-start gap-2 disabled:opacity-50 ${
                    active ? "bg-primary/10" : "hover:bg-muted"
                  }`}
                  data-testid={`option-persona-${r}`}
                >
                  <Check
                    className={`h-4 w-4 mt-0.5 shrink-0 ${active ? "text-primary" : "text-transparent"}`}
                  />
                  <span>
                    <span className={`block text-sm font-medium ${active ? "text-primary" : "text-foreground"}`}>
                      {PERSONA_LABELS[r]}
                    </span>
                    <span className="block text-xs text-muted-foreground leading-snug">
                      {PERSONA_DESCRIPTIONS[r]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
