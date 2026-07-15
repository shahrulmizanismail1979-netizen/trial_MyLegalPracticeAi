import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

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

  const [busy, setBusy] = useState(false);

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

      <div className="mt-5 flex flex-col sm:flex-row gap-3">
        {user.accountType === "email" && (
          <Link href="/pricing" className="flex-1">
            <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" data-testid="button-view-plans">
              {user.tier === "starter"
                ? isBm ? "Naik Taraf Pelan" : "Upgrade Plan"
                : isBm ? "Tukar Pelan" : "Change Plan"}
            </Button>
          </Link>
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
