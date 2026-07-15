import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";

const TIER_LABEL: Record<string, { en: string; bm: string }> = {
  professional: { en: "Professional", bm: "Profesional" },
  premium: { en: "Premium", bm: "Premium" },
  firm: { en: "Firm", bm: "Firma" },
};

export default function UpgradePrompt({
  requiredTier,
  featureName,
  featureNameBm,
}: {
  requiredTier: string;
  featureName: string;
  featureNameBm: string;
}) {
  const { mode } = useLanguage();
  const { user } = useAuth();
  const isBm = mode === "bm";
  const tier = TIER_LABEL[requiredTier] ?? { en: requiredTier, bm: requiredTier };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card className="border-secondary/40">
        <CardContent className="py-10 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-secondary/15 border border-secondary/30 flex items-center justify-center">
            <svg className="w-7 h-7 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-serif font-bold text-foreground">
            {isBm ? `${featureNameBm} dikunci` : `${featureName} is locked`}
          </h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            {isBm
              ? `Ciri ini memerlukan pelan ${tier.bm} atau lebih tinggi. Naik taraf untuk membuka aksesnya.`
              : `This feature requires the ${tier.en} plan or higher. Upgrade to unlock access.`}
          </p>
          {user?.accountType === "code" ? (
            <p className="text-xs text-muted-foreground mt-4">
              {isBm
                ? "Akaun kod akses sepatutnya mempunyai akses penuh — sila log masuk semula."
                : "Access-code accounts should have full access — try logging in again."}
            </p>
          ) : (
            <Link href="/pricing">
              <Button className="mt-5 bg-primary hover:bg-primary/90 text-primary-foreground" data-testid="button-upgrade">
                {isBm ? "Lihat Pelan" : "View Plans"}
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
