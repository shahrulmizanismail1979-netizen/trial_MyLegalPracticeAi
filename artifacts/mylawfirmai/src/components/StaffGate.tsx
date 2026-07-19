import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useStaffLogin } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck } from "lucide-react";
import { useT, useLanguage, LANGUAGES, type Lang } from "@/lib/i18n";

/**
 * Full-screen authentication gate. The whole app sits behind a single shared
 * staff passcode: the server verifies it and mints an httpOnly session cookie,
 * which is the primary trust boundary for every API route. Until the caller
 * holds a verified session, nothing in the app is reachable.
 */
export function StaffGate({ children }: { children: React.ReactNode }) {
  const { authenticated, sessionChecked, setAuthenticated } = useAuth();
  const { mutateAsync: staffLogin, isPending } = useStaffLogin();
  const t = useT();
  const { lang, setLang } = useLanguage();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = async () => {
    try {
      const res = await staffLogin({ data: { passcode: passcode.trim() } });
      if (!res.staff) {
        setError(true);
        return;
      }
      setError(false);
      setPasscode("");
      setAuthenticated(true);
    } catch {
      setError(true);
    }
  };

  // Wait for the initial session check so we don't flash the login screen for
  // an already-authenticated user.
  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">{t("gate.checking")}</p>
      </div>
    );
  }

  if (authenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="absolute top-5 right-6 flex gap-1">
        {LANGUAGES.map((l) => (
          <button
            key={l.value}
            type="button"
            onClick={() => setLang(l.value as Lang)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              lang === l.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-lg space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl jewel-gradient text-white shadow-md">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h1 className="font-display text-3xl jewel-gradient-text">
              {t("gate.title")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("gate.subtitle")}</p>
          </div>
        </div>
        <div className="space-y-3">
          <Input
            type="password"
            autoFocus
            value={passcode}
            placeholder={t("gate.placeholder")}
            onChange={(e) => {
              setPasscode(e.target.value);
              setError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            className="h-11 rounded-xl text-center"
          />
          {error && (
            <p className="text-sm text-destructive text-center">
              {t("gate.error")}
            </p>
          )}
          <Button
            onClick={handleSubmit}
            disabled={isPending || passcode.trim().length === 0}
            className="w-full h-11 rounded-xl font-semibold"
          >
            {t("gate.submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
