import { useEffect, useState } from "react";
import { Loader2, Lock, CircleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { vaultVerify, vaultLogin } from "@/lib/irac-api";

// Wraps resources that require a signed-in access code even to read (matters,
// bundles, the deadline diary). Shows a passcode prompt when not authenticated,
// then renders its children once a session exists.
export function AccessGate({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<"checking" | "login" | "ok">("checking");
  const [passcode, setPasscode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    vaultVerify()
      .then((ok) => live && setPhase(ok ? "ok" : "login"))
      .catch(() => live && setPhase("login"));
    return () => {
      live = false;
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await vaultLogin(passcode.trim());
      setPhase("ok");
    } catch (ex) {
      setErr((ex as Error).message || t("gate.error"));
    } finally {
      setBusy(false);
    }
  };

  if (phase === "checking") {
    return (
      <div className="flex items-center justify-center gap-2 text-muted-foreground py-24">
        <Loader2 className="h-5 w-5 animate-spin" /> {t("common.loading")}
      </div>
    );
  }

  if (phase === "login") {
    return (
      <div className="max-w-md mx-auto px-6 py-16 w-full">
        <Card>
          <CardContent className="p-8 space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[hsl(var(--gold)/0.12)] flex items-center justify-center">
                <Lock className="h-5 w-5 text-[hsl(var(--gold-bright))]" />
              </div>
              <div>
                <h2 className="font-serif text-xl font-semibold text-foreground">{t("gate.title")}</h2>
                <p className="text-xs text-muted-foreground">{t("gate.subtitle")}</p>
              </div>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label>{t("gate.passcode")}</Label>
                <Input
                  className="mt-1"
                  type="password"
                  autoFocus
                  placeholder={t("gate.passcodeHint")}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                />
              </div>
              {err && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <CircleAlert className="h-4 w-4" />
                  {err}
                </div>
              )}
              <Button type="submit" disabled={busy || !passcode.trim()} className="w-full gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                {t("gate.signIn")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
