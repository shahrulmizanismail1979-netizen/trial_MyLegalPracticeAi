import { useState } from "react";
import { Sparkles, UserCog } from "lucide-react";
import {
  usePersona,
  PERSONA_ROLES,
  PERSONA_LABELS,
  PERSONA_DESCRIPTIONS,
  PERSONA_DASHBOARD_FRAMING,
  type PersonaRole,
} from "@workspace/persona-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Small badge + tagline shown near the hero when a professional mode is active.
 * Uses the shared persona layer; renders nothing when no mode is set.
 */
export function PersonaBadge() {
  const { role } = usePersona();
  if (!role) return null;
  const framing = PERSONA_DASHBOARD_FRAMING[role];
  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      <span className="chip-glass inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium text-[hsl(40_28%_85%)]">
        <Sparkles className="w-3.5 h-3.5 text-[hsl(var(--gold-bright))]" />
        {PERSONA_LABELS[role]}
      </span>
      <p className="text-sm text-[hsl(40_24%_78%)] font-sans max-w-xl">
        {framing.tagline}
      </p>
    </div>
  );
}

/**
 * "Professional mode" switcher. Lists the shared persona roles and persists a
 * change through the shared /api/personas endpoint via usePersona().
 */
export function PersonaSwitcher() {
  const { role, code, saving, switchRole } = usePersona();
  const { toast } = useToast();
  const { lang } = useLanguage();
  const [pending, setPending] = useState<PersonaRole | null>(null);

  const handleChange = async (next: string) => {
    const nextRole = next as PersonaRole;
    setPending(nextRole);
    try {
      await switchRole(nextRole);
      toast({
        title:
          lang === "ms"
            ? "Mod profesional dikemas kini"
            : "Professional mode updated",
        description: PERSONA_LABELS[nextRole],
      });
    } catch (ex) {
      toast({
        variant: "destructive",
        title:
          lang === "ms"
            ? "Tidak dapat menyimpan mod"
            : "Could not save mode",
        description: (ex as Error).message,
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <Card className="border-[hsl(var(--gold))]/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-lg text-foreground">
          <UserCog className="w-5 h-5 text-[hsl(var(--gold-bright))]" />
          {lang === "ms" ? "Mod Profesional" : "Professional mode"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {code ? (
          <>
            <p className="text-sm text-muted-foreground mb-3">
              {lang === "ms"
                ? "Sesuaikan cara papan pemuka merangka alat anda."
                : "Tailor how the dashboard frames your tools."}
            </p>
            <Select
              value={role ?? undefined}
              onValueChange={handleChange}
              disabled={saving}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    lang === "ms" ? "Pilih mod…" : "Choose a mode…"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {PERSONA_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    <span className="flex flex-col">
                      <span className="font-medium">{PERSONA_LABELS[r]}</span>
                      <span className="text-xs text-muted-foreground">
                        {PERSONA_DESCRIPTIONS[r]}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {saving && pending && (
              <p className="mt-2 text-xs text-muted-foreground">
                {lang === "ms" ? "Menyimpan…" : "Saving…"}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {lang === "ms"
              ? "Log masuk semula dengan kod akses anda untuk mengaktifkan penukaran mod."
              : "Log in again with your access code to enable switching."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
