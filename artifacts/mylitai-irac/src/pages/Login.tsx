import { useEffect, useState } from "react";
import { Scale, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { vaultLogin, vaultSsoLogin } from "@/lib/irac-api";

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

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsLink, setNeedsLink] = useState(false);
  const [msTicket, setMsTicket] = useState("");
  const [msEmail, setMsEmail] = useState("");
  const [linkCode, setLinkCode] = useState("");
  const { lang } = useLanguage();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const msError = params.get("ms_error");
    const ticket = params.get("ms_ticket");
    const email = params.get("ms_email") || "";
    if (!msError && !ticket) return;

    history.replaceState(null, "", window.location.pathname);

    if (msError) {
      setError(msError);
      return;
    }
    if (ticket) {
      setMsEmail(email);
      setLoading(true);
      vaultSsoLogin(ticket).then((result) => {
        setLoading(false);
        if (result.success) {
          onSuccess();
        } else if (result.needsLink) {
          setMsTicket(ticket);
          setNeedsLink(true);
        } else {
          setError(
            result.error ||
              (lang === "ms"
                ? "Log masuk Microsoft gagal. Sila cuba lagi."
                : "Microsoft sign-in failed. Please try again."),
          );
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const invalidCodeMsg =
    lang === "ms"
      ? "Kod akses tidak sah atau telah tamat tempoh. Sila cuba lagi."
      : "Invalid or expired access code. Please try again.";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    try {
      await vaultLogin(code.trim());
      onSuccess();
    } catch (ex) {
      setError((ex as Error).message || invalidCodeMsg);
      setLoading(false);
    }
  };

  const handleMicrosoft = () => {
    window.location.href = `/auth/microsoft/login?app=${APP_SLUG}`;
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkCode.trim()) return;
    setLoading(true);
    setError("");
    const result = await vaultSsoLogin(msTicket, linkCode.trim());
    setLoading(false);
    if (result.success) {
      onSuccess();
    } else {
      setError(result.error || invalidCodeMsg);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-[hsl(var(--oxford-deep))]/40 via-background to-background" />

      <div className="relative z-10 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 bg-card border-2 border-[hsl(var(--gold))] rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-[hsl(var(--gold))]/20">
            <Scale className="h-8 w-8 text-[hsl(var(--gold-bright))]" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground text-center">
            MyLitigation<span className="text-gradient-gold">Practice</span>AI
          </h1>
          <p className="text-muted-foreground mt-2">
            {lang === "ms" ? "Akses Pengamal Selamat" : "Secure Practitioner Access"}
          </p>
        </div>

        <Card className="border-[hsl(var(--gold))]/20 shadow-2xl">
          <CardContent className="p-8">
            {needsLink ? (
              <form onSubmit={handleLinkSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Lock className="h-4 w-4 text-[hsl(var(--gold-bright))]" />{" "}
                    {lang === "ms" ? "Kod Akses" : "Access Code"}
                  </label>
                  <p className="text-sm text-muted-foreground">
                    {lang === "ms"
                      ? `Kali pertama log masuk dengan Microsoft${msEmail ? ` (${msEmail})` : ""} — masukkan kod akses anda sekali untuk memautkannya.`
                      : `First time signing in with Microsoft${msEmail ? ` (${msEmail})` : ""} — enter your access code once to link it.`}
                  </p>
                  <Input
                    type="password"
                    placeholder={lang === "ms" ? "Masukkan kod akses anda" : "Enter your access code"}
                    value={linkCode}
                    onChange={(e) => setLinkCode(e.target.value)}
                    autoFocus
                    disabled={loading}
                    className="h-12 text-lg"
                  />
                  {error && <p className="text-sm text-destructive font-medium">{error}</p>}
                </div>
                <Button type="submit" size="lg" className="w-full text-lg" disabled={loading || !linkCode.trim()}>
                  {loading
                    ? lang === "ms"
                      ? "Mengesahkan..."
                      : "Verifying..."
                    : lang === "ms"
                      ? "Masuk"
                      : "Enter"}
                </Button>
              </form>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Lock className="h-4 w-4 text-[hsl(var(--gold-bright))]" />{" "}
                      {lang === "ms" ? "Kod Akses" : "Access Code"}
                    </label>
                    <Input
                      type="password"
                      placeholder={lang === "ms" ? "Masukkan kod akses anda" : "Enter your access code"}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      autoFocus
                      disabled={loading}
                      className="h-12 text-lg"
                    />
                    {error && <p className="text-sm text-destructive font-medium">{error}</p>}
                  </div>
                  <Button type="submit" size="lg" className="w-full text-lg" disabled={loading || !code.trim()}>
                    {loading
                      ? lang === "ms"
                        ? "Mengesahkan..."
                        : "Verifying..."
                      : lang === "ms"
                        ? "Masuk"
                        : "Enter"}
                  </Button>
                </form>

                <div className="flex items-center gap-3 my-6">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs uppercase text-muted-foreground">
                    {lang === "ms" ? "atau" : "or"}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full text-base gap-2"
                  onClick={handleMicrosoft}
                  disabled={loading}
                >
                  <MicrosoftLogo />
                  {lang === "ms" ? "Log masuk dengan Microsoft" : "Sign in with Microsoft"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>
    </div>
  );
}
