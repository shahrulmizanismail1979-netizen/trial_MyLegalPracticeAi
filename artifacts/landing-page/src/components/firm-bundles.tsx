import { Check, Building2, Building, Briefcase, Crown } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/lib/currency";
import { useBundleCheckout } from "@/lib/use-bundle-checkout";
import { BilledInUsdNote } from "@/components/currency-selector";
import { ComplimentaryPerks } from "@/components/complimentary-perks";

const INDIVIDUAL_BUNDLE_PRICE = 79;

const tiers = [
  {
    name: "Boutique",
    icon: Briefcase,
    description: "Small firms & chambers",
    seats: 5,
    monthlyPrice: 355,
    solarKwp: null as number | null,
    features: [
      "Access to every portal included in the Complete Bundle",
      "5 user licenses",
      "Monthly subscription — cancel anytime",
      "Centralised billing",
      "Email support",
    ],
  },
  {
    name: "Practice",
    icon: Building,
    description: "Mid-sized law firms",
    seats: 15,
    monthlyPrice: 1005,
    featured: true,
    solarKwp: 4,
    features: [
      "Access to every portal included in the Complete Bundle",
      "15 user licenses",
      "Monthly subscription — cancel anytime",
      "Centralised billing & admin",
      "Priority support",
      "Onboarding session included",
    ],
  },
  {
    name: "Firm",
    icon: Building2,
    description: "Large firms & legal departments",
    seats: 30,
    monthlyPrice: 1890,
    solarKwp: 7,
    features: [
      "Access to every portal included in the Complete Bundle",
      "30 user licenses",
      "Monthly subscription — cancel anytime",
      "Dedicated account manager",
      "Priority support",
      "Onboarding & training session",
      "Quarterly check-ins",
    ],
  },
  {
    name: "Enterprise",
    icon: Crown,
    description: "Organisations needing 50+ seats",
    seats: null,
    monthlyPrice: null,
    solarKwp: 9.45,
    features: [
      "Access to every portal included in the Complete Bundle",
      "50+ user licenses",
      "Flexible subscription terms",
      "Dedicated account manager",
      "Custom onboarding & training",
      "SLA & white-glove support",
      "Tailored billing arrangements",
    ],
  },
];

const ENTERPRISE_WHATSAPP_URL = `https://wa.me/60139725475?text=${encodeURIComponent("Hi, I'd like to discuss enterprise licensing for the AI Portals for my organisation.")}`;

/** Checkout tier ids understood by /api/stripe/checkout. */
const CHECKOUT_TIER_BY_NAME: Record<string, string> = {
  Boutique: "firm-boutique",
  Practice: "firm-practice",
  Firm: "firm-firm",
};

export function FirmBundles() {
  const { format } = useCurrency();
  const { startCheckout, loadingTier, error } = useBundleCheckout();
  const bundleWhatsAppUrl = (tierName: string) =>
    `https://wa.me/60139725475?text=${encodeURIComponent(
      `Hi, I'd like to subscribe to the ${tierName} firm bundle. Please help me get set up.`,
    )}`;

  return (
    <section id="firm-bundles" className="py-24 px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
          <Building2 className="h-4 w-4" />
          For Law Firms & Organisations
        </div>
        <h2 className="text-3xl md:text-5xl font-serif font-bold mb-6">
          Bundles for <span className="text-primary">Teams of Every Size</span>
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Every team member gets full access to every portal included in the Complete Bundle. Volume pricing scales with your team —
the larger your firm, the lower the equivalent per-user cost.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {tiers.map((tier) => {
          const Icon = tier.icon;
          const isEnterprise = tier.name === "Enterprise";

          const perUser = tier.seats
            ? Math.round((tier.monthlyPrice! / tier.seats) * 100) / 100
            : null;

          const individualTotal = tier.seats
            ? tier.seats * INDIVIDUAL_BUNDLE_PRICE
            : null;

          const yearlySavings = tier.seats && tier.monthlyPrice
            ? (individualTotal! - tier.monthlyPrice) * 12
            : null;

          return (
            <Card
              key={tier.name}
              className={`flex flex-col ${
                tier.featured
                  ? "border-primary shadow-[0_0_30px_rgba(99,149,224,0.12)] bg-card relative"
                  : "bg-card/50 border-border/50"
              }`}
            >
              {tier.featured && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-bl-lg">
                  Most Popular
                </div>
              )}
              <CardHeader className="pb-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="font-serif text-2xl">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="mb-2">
                  {isEnterprise ? (
                    <div className="text-3xl font-bold text-foreground">Custom</div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-bold text-foreground">{format(tier.monthlyPrice!)}</span>
                        <span className="text-sm text-muted-foreground">/month</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {format(tier.monthlyPrice! * 12)} / year
                      </p>
                      <BilledInUsdNote />
                    </>
                  )}
                </div>

                {!isEnterprise && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {tier.seats} user licences · every Complete Bundle portal each
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Equivalent to ~{format(perUser!)}/user when shared across {tier.seats} licenses
                    </p>
                  </>
                )}

                {yearlySavings && yearlySavings > 0 && (
                  <p className="text-xs text-primary mt-3 mb-6">
                    Save {format(yearlySavings!)}/yr vs {tier.seats} individual Complete Bundle
                    subscriptions at {format(INDIVIDUAL_BUNDLE_PRICE)}/mo each
                  </p>
                )}
                {isEnterprise && <div className="mt-2 mb-6" />}

                <ul className="space-y-3 mb-4 flex-1">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground/80">{feature}</span>
                    </li>
                  ))}
                </ul>

                <ComplimentaryPerks solarKwp={tier.solarKwp} />
              </CardContent>
              <CardFooter>
                {isEnterprise ? (
                  <a
                    href={ENTERPRISE_WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full"
                  >
                    <Button variant="outline" className="w-full">
                      Contact Sales
                    </Button>
                  </a>
                ) : (
                  <div className="w-full space-y-2">
                    <Button
                      variant={tier.featured ? "default" : "outline"}
                      className={`w-full ${
                        tier.featured ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""
                      }`}
                      disabled={loadingTier !== null}
                      onClick={() => startCheckout(CHECKOUT_TIER_BY_NAME[tier.name]!)}
                    >
                      {loadingTier === CHECKOUT_TIER_BY_NAME[tier.name]
                        ? "Redirecting to checkout..."
                        : "Get This Bundle"}
                    </Button>
                    <a
                      href={bundleWhatsAppUrl(tier.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center text-xs text-muted-foreground hover:text-primary underline underline-offset-2"
                    >
                      Questions? Chat with us on WhatsApp
                    </a>
                  </div>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <div className="mt-12 text-center max-w-3xl mx-auto">
        <p className="text-sm text-muted-foreground">
          All firm bundles are monthly starter packages — new advanced AI features added later are
charged pay-as-you-go based on usage. They include centralised billing and admin access. Need a different seat
count or custom terms?{" "}
          <a href={ENTERPRISE_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Talk to us on WhatsApp
          </a>
          .
        </p>
      </div>
    </section>
  );
}
