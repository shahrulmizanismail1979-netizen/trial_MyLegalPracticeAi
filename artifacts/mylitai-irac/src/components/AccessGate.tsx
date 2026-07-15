import { useEffect, useState } from "react";
import { Loader2, Lock, CircleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { vaultVerify, vaultLogin, vaultSsoLogin } from "@/lib/irac-api";

const APP_SLUG = "lit-irac";

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true" className="shrink-0">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

// Wraps resources that require a signed-in access code even to read (matters,
// bundles, the deadline diary). Shows a passcode prompt when not authenticated,
// then renders its children once a session exists.
export function AccessGate({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<"checking" | "login" | "ok">("checking");
  const [passcode, setPasscode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsLink, setNeedsLink] = useState(false);
  const [msTicket, setMsTicket] = useState("");
  const [msEmail, setMsEmail] = useState("");
  const [linkCode, setLinkCode] = useState("");

  useEffect(() => {
    let live = true;
    const params = new URLSearchParams(window.location.search);
    const msError = params.get("ms_error");
    const ticket = params.get("ms_ticket");
    const email = params.get("ms_email") || "";

    if (msError || ticket) {
      history.replaceState(null, "", window.location.pathname);
      if (msError) {
        setErr(msError);
        setPhase("login");
        return;
      }
      if (ticket) {
        setMsEmail(email);
        vaultSsoLogin(ticket).then((result) => {
          if (!live) return;
          if (result.success) {
            setPhase("ok");
          } else if (result.needsLink) {
            setMsTicket(ticket);
            setNeedsLink(true);
            setPhase("login");
          } else {
            setErr(result.error || t("gate.error"));
            setPhase("login");
          }
        });
        return;
      }
    }

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

  const handleMicrosoft = () => {
    window.location.href = `/auth/microsoft/login?app=${APP_SLUG}`;
  };

  const submitLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkCode.trim()) return;
    setBusy(true);
    setErr(null);
    const result = await vaultSsoLogin(msTicket, linkCode.trim());
    setBusy(false);
    if (result.success) {
      setPhase("ok");
    } else {
      setErr(result.error || t("gate.error"));
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
            {needsLink ? (
              <form onSubmit={submitLink} className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {`First time signing in with Microsoft${msEmail ? ` (${msEmail})` : ""} — enter your access code once to link it.`}
                </p>
                <div>
                  <Label>{t("gate.passcode")}</Label>
                  <Input
                    className="mt-1"
                    type="password"
                    autoFocus
                    placeholder={t("gate.passcodeHint")}
                    value={linkCode}
                    onChange={(e) => setLinkCode(e.target.value)}
                  />
                </div>
                {err && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <CircleAlert className="h-4 w-4" />
                    {err}
                  </div>
                )}
                <Button type="submit" disabled={busy || !linkCode.trim()} className="w-full gap-2">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  {t("gate.signIn")}
                </Button>
                <button
                  type="button"
                  onClick={() => { window.location.href = `/auth/microsoft/login?app=${APP_SLUG}&prompt=select_account`; }}
                  className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
                >
                  Use another Microsoft account?
                </button>
              </form>
            ) : (
              <>
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

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs uppercase text-muted-foreground">or</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleMicrosoft}
                  disabled={busy}
                  className="w-full gap-2"
                >
                  <MicrosoftLogo />
                  Sign in with Microsoft
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
