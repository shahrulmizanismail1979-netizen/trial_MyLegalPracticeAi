import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  usePersona,
  PERSONA_ROLES,
  PERSONA_LABELS,
  PERSONA_DESCRIPTIONS,
  type PersonaRole,
} from "@workspace/persona-client";

const TIER_LABEL: Record<string, { en: string; bm: string }> = {
  starter: { en: "Starter", bm: "Permulaan" },
  professional: { en: "Professional", bm: "Profesional" },
  premium: { en: "Premium", bm: "Premium" },
  firm: { en: "Firm", bm: "Firma" },
};

export default function AccountPage() {
  const { user, refresh } = useAuth();
  const { mode } = useLanguage();
  const { toast } = useToast();
  const isBm = mode === "bm";

  const { role, code: personaCode, saving, switchRole } = usePersona();

  const [busy, setBusy] = useState(false);

  const handleSwitchRole = async (next: PersonaRole) => {
    try {
      await switchRole(next);
      toast({
        title: isBm ? "Mod profesional dikemas kini" : "Professional mode updated",
        description: PERSONA_LABELS[next],
      });
    } catch (e) {
      toast({
        title: isBm ? "Tidak dapat menyimpan mod" : "Could not save professional mode",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      api.billing
        .sync()
        .catch(() => {})
        .finally(() => {
          refresh();
          toast({
            title: isBm ? "Langganan dikemas kini" : "Subscription updated",
            description: isBm
              ? "Terima kasih! Akses anda telah dikemas kini."
              : "Thank you! Your access has been updated.",
          });
        });
      window.history.replaceState({}, "", window.location.pathname);
    } else {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePortal = async () => {
    setBusy(true);
    try {
      const { url } = await api.billing.portal();
      window.location.href = url;
    } catch (e) {
      toast({
        title: isBm ? "Tidak dapat membuka portal" : "Could not open billing portal",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
      setBusy(false);
    }
  };

  if (!user) return null;

  const tierLabel = TIER_LABEL[user.tier] ?? { en: user.tier, bm: user.tier };
  const isPaid = user.accountType === "email" && user.tier !== "starter";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-serif font-bold text-foreground mb-6">
        {isBm ? "Akaun & Langganan" : "Account & Subscription"}
      </h1>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {isBm ? "Maklumat Akaun" : "Account Details"}
          </h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{isBm ? "Nama" : "Name"}</span>
            <span className="text-foreground font-medium" data-testid="text-account-name">{user.name}</span>
          </div>
          {user.email && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{isBm ? "E-mel" : "Email"}</span>
              <span className="text-foreground font-medium" data-testid="text-account-email">{user.email}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{isBm ? "Jenis Akaun" : "Account Type"}</span>
            <span className="text-foreground font-medium capitalize">
              {user.accountType === "code" ? (isBm ? "Kod Akses" : "Access Code") : (isBm ? "E-mel" : "Email")}
            </span>
          </div>
          <div className="flex justify-between text-sm items-center">
            <span className="text-muted-foreground">{isBm ? "Pelan Semasa" : "Current Plan"}</span>
            <span className="text-[11px] uppercase font-semibold px-2 py-0.5 rounded bg-secondary/20 text-secondary" data-testid="text-account-tier">
              {isBm ? tierLabel.bm : tierLabel.en}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 mt-5" data-testid="card-persona">
        <CardHeader className="pb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {isBm ? "Mod Profesional" : "Professional Mode"}
          </h2>
        </CardHeader>
        <CardContent className="space-y-2">
          {personaCode ? (
            <>
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                {isBm
                  ? "Pilih mod profesional untuk menyesuaikan pengalaman anda merentasi platform."
                  : "Pick a professional mode to tailor the experience across the platform."}
              </p>
              {PERSONA_ROLES.map((r) => {
                const active = r === role;
                return (
                  <button
                    key={r}
                    type="button"
                    disabled={saving}
                    onClick={() => handleSwitchRole(r)}
                    data-testid={`button-persona-${r}`}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      active
                        ? "border-secondary/50 bg-secondary/10"
                        : "border-border/40 bg-card/50 hover:border-border hover:bg-card"
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{PERSONA_LABELS[r]}</span>
                      {active && (
                        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-secondary/20 text-secondary">
                          {isBm ? "Aktif" : "Active"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {PERSONA_DESCRIPTIONS[r]}
                    </p>
                  </button>
                );
              })}
            </>
          ) : (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isBm
                ? "Log masuk semula dengan kod akses anda untuk mengaktifkan penukaran mod profesional."
                : "Log in again with your access code to enable switching."}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="mt-5 flex flex-col sm:flex-row gap-3">
        {user.accountType === "email" && (
          <Button className="flex-1 w-full bg-primary hover:bg-primary/90 text-primary-foreground" data-testid="button-view-plans" asChild>
            <Link href="/pricing">
              {user.tier === "starter"
                ? isBm ? "Naik Taraf Pelan" : "Upgrade Plan"
                : isBm ? "Tukar Pelan" : "Change Plan"}
            </Link>
          </Button>
        )}
        {isPaid && (
          <Button
            variant="outline"
            className="flex-1"
            disabled={busy}
            onClick={handlePortal}
            data-testid="button-manage-billing"
          >
            {busy
              ? isBm ? "Membuka..." : "Opening..."
              : isBm ? "Urus Langganan" : "Manage Subscription"}
          </Button>
        )}
        <Button variant="outline" className="flex-1" asChild>
          <a href="/unsubscribe" data-testid="link-unsubscribe-from-profile">
            {isBm ? "Batalkan percubaan / nyahlanggan" : "Cancel free trial / unsubscribe"}
          </a>
        </Button>
      </div>

      {user.accountType === "code" && (
        <p className="text-xs text-muted-foreground mt-4">
          {isBm
            ? "Akaun kod akses mempunyai akses penuh ke semua ciri."
            : "Access-code accounts have full access to all features."}
        </p>
      )}
    </div>
  );
}
