import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface PackageDef {
  tier: string;
  name: string;
  nameBm: string;
  priceMyr: number;
  lookupKey: string | null;
  tagline: string;
  taglineBm: string;
  features: string[];
  featuresBm: string[];
}

const TIER_ORDER = ["starter", "professional", "premium", "firm"];

export default function PricingPage() {
  const { user, refresh } = useAuth();
  const { mode } = useLanguage();
  const { toast } = useToast();
  const isBm = mode === "bm";

  const [packages, setPackages] = useState<PackageDef[]>([]);
  const [currency, setCurrency] = useState("MYR");
  const [loading, setLoading] = useState(true);
  const [busyTier, setBusyTier] = useState<string | null>(null);

  useEffect(() => {
    api.billing
      .packages()
      .then((data) => {
        setPackages(data.packages || []);
        setCurrency(data.currency || "MYR");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    refresh();
  }, [refresh]);

  const currentRank = user ? TIER_ORDER.indexOf(user.tier) : -1;

  const handleSubscribe = async (tier: string) => {
    setBusyTier(tier);
    try {
      const { url } = await api.billing.checkout(tier);
      window.location.href = url;
    } catch (e) {
      toast({
        title: isBm ? "Tidak dapat memulakan pembayaran" : "Could not start checkout",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
      setBusyTier(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">
          {isBm ? "Pelan & Harga" : "Plans & Pricing"}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {isBm
            ? "Pilih pelan yang sesuai dengan amalan anda. Tukar atau batal bila-bila masa."
            : "Choose the plan that fits your practice. Change or cancel anytime."}
        </p>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground">Loading...</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {packages.map((pkg) => {
            const rank = TIER_ORDER.indexOf(pkg.tier);
            const isCurrent = user?.tier === pkg.tier;
            const isDowngrade = currentRank >= 0 && rank < currentRank;
            const featured = pkg.tier === "premium";
            const features = isBm ? pkg.featuresBm : pkg.features;
            return (
              <Card
                key={pkg.tier}
                className={`flex flex-col ${featured ? "border-secondary shadow-lg shadow-secondary/10" : "border-border/50"}`}
                data-testid={`card-plan-${pkg.tier}`}
              >
                <CardHeader className="pb-3">
                  {featured && (
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-secondary mb-1">
                      {isBm ? "Paling Popular" : "Most Popular"}
                    </span>
                  )}
                  <h2 className="text-lg font-serif font-bold text-foreground">
                    {isBm ? pkg.nameBm : pkg.name}
                  </h2>
                  <p className="text-xs text-muted-foreground min-h-[2.5rem]">
                    {isBm ? pkg.taglineBm : pkg.tagline}
                  </p>
                  <div className="mt-2">
                    <span className="text-2xl font-bold text-foreground">
                      {pkg.priceMyr === 0 ? (isBm ? "Percuma" : "Free") : `${currency} ${pkg.priceMyr}`}
                    </span>
                    {pkg.priceMyr > 0 && (
                      <span className="text-xs text-muted-foreground">/{isBm ? "bulan" : "mo"}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col flex-1">
                  <ul className="space-y-2 flex-1">
                    {features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                        <svg className="w-3.5 h-3.5 text-secondary mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    {isCurrent ? (
                      <Button disabled variant="outline" className="w-full" data-testid={`button-current-${pkg.tier}`}>
                        {isBm ? "Pelan Semasa" : "Current Plan"}
                      </Button>
                    ) : pkg.tier === "starter" ? (
                      <Button disabled variant="outline" className="w-full">
                        {isBm ? "Asas Percuma" : "Free Tier"}
                      </Button>
                    ) : (
                      <Button
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                        disabled={busyTier !== null}
                        onClick={() => handleSubscribe(pkg.tier)}
                        data-testid={`button-subscribe-${pkg.tier}`}
                      >
                        {busyTier === pkg.tier
                          ? isBm ? "Memproses..." : "Processing..."
                          : isDowngrade
                            ? isBm ? "Tukar Pelan" : "Switch Plan"
                            : isBm ? "Langgan" : "Subscribe"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {user?.accountType === "code" && (
        <p className="text-center text-xs text-muted-foreground mt-6">
          {isBm
            ? "Akaun kod akses anda sudah mempunyai akses penuh."
            : "Your access-code account already has full access."}
        </p>
      )}
    </div>
  );
}
