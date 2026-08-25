import { Check, Building2, Factory, Briefcase, Crown, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/lib/currency";
import { useBundleCheckout } from "@/lib/use-bundle-checkout";
import { BilledInUsdNote } from "@/components/currency-selector";
import { ComplimentaryPerks } from "@/components/complimentary-perks";
import { getCatalogUsdAmount, useStripeCatalogPrices } from "@/lib/stripe-catalog-prices";

const tiers = [
  {
    name: "Startup Legal",
    icon: Briefcase,
    description: "SMEs & startup in-house teams",
    seats: 3,
    catalogTier: "corp-startup" as const,
    headline: "Foundational corporate-advisory toolkit",
    includes: null,
    solarKwp: null as number | null,
    features: [
      "Access to every portal included in the Complete Bundle",
      "Contract review & drafting templates",
      "3 user licenses",
      "Monthly subscription — cancel anytime",
      "Centralised billing",
      "Email support",
    ],
  },
  {
    name: "Growth",
    icon: Building2,
    description: "Growing companies & in-house counsel",
    seats: 8,
    catalogTier: "corp-growth" as const,
    featured: true,
    headline: "Adds compliance + AI advisory assistant",
    includes: "Startup Legal",
    solarKwp: 4,
    features: [
      "Corporate advisory AI assistant",
      "Regulatory compliance tracker (Bursa, SC, BNM)",
      "Upgraded to 8 user licenses",
      "Centralised billing & admin",
      "Priority support",
      "Onboarding session included",
    ],
  },
  {
    name: "Corporate",
    icon: Factory,
    description: "GLCs & large corporations",
    seats: 20,
    catalogTier: "corp-corporate" as const,
    headline: "Adds board, M&A & due diligence modules",
    includes: "Growth",
    solarKwp: 7,
    features: [
      "Board & directors' duties advisory module",
      "M&A and due diligence playbooks",
      "Upgraded to 20 user licenses",
      "Dedicated account manager",
      "Onboarding & training session",
      "Quarterly check-ins",
    ],
  },
  {
    name: "Group / Enterprise",
    icon: Crown,
    description: "Conglomerates & multi-entity groups",
    seats: null,
    catalogTier: null,
    headline: "Adds ESG, group governance & cross-border mapping",
    includes: "Corporate",
    solarKwp: 9.45,
    features: [
      "Group governance & ESG advisory module",
      "Cross-border regulatory mapping",
      "30+ user licenses, multi-entity / subsidiary access",
      "Flexible subscription terms",
      "Custom onboarding & training",
      "SLA & white-glove support",
    ],
  },
];

const ENTERPRISE_WHATSAPP_URL = `https://wa.me/60139725475?text=${encodeURIComponent("Hi, I'd like to discuss group/enterprise licensing of the AI Portals for our company.")}`;

const CHECKOUT_TIER_BY_NAME: Record<string, string> = {
  "Startup Legal": "corp-startup",
  Growth: "corp-growth",
  Corporate: "corp-corporate",
};

export function CorporateBundles() {
  const { format } = useCurrency();
  const { prices, isLoading: isPricesLoading } = useStripeCatalogPrices();
  const { startCheckout, loadingTier } = useBundleCheckout();
  const individualBundlePrice = getCatalogUsdAmount(prices, "bundle");
  const bundleWhatsAppUrl = (tierName: string) =>
    `https://wa.me/60139725475?text=${encodeURIComponent(
      `Hi, I'd like to subscribe to the ${tierName} corporate bundle. Please help me get set up.`,
    )}`;

  return (
    <section id="corporate-bundles" className="py-24 px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
          <Factory className="h-4 w-4" />
          For Companies, Corporations & Organisations
        </div>
        <h2 className="text-3xl md:text-5xl font-serif font-bold mb-6">
          Equip Your <span className="text-primary">In-house Legal Team</span>
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Tiered for corporate legal advisory work — each level adds advisory depth on top of
the previous one. Centralised billing, volume pricing, and priority support across
your organisation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {tiers.map((tier) => {
          const Icon = tier.icon;
          const isEnterprise = tier.name === "Group / Enterprise";
          const monthlyPrice = tier.catalogTier
            ? getCatalogUsdAmount(prices, tier.catalogTier)
            : null;
          const priceState = isPricesLoading
            ? "Loading price…"
            : monthlyPrice == null && !isEnterprise
              ? "Price unavailable"
              : null;

          const perUser = tier.seats && monthlyPrice != null
            ? Math.round((monthlyPrice / tier.seats) * 100) / 100
            : null;

          const individualTotal = tier.seats && individualBundlePrice != null
            ? tier.seats * individualBundlePrice
            : null;

          const yearlySavings = tier.seats && monthlyPrice != null && individualTotal != null
            ? (individualTotal - monthlyPrice) * 12
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
                         <span
                           className="text-3xl font-bold text-foreground"
                           data-testid={`subscription-price-${tier.catalogTier}`}
                           data-tier={tier.catalogTier}
                         >
                           {priceState ?? format(monthlyPrice!)}
                         </span>
                         {monthlyPrice != null && <span className="text-sm text-muted-foreground">/month</span>}
                      </div>
                       {monthlyPrice != null && (
                         <>
                           <p className="text-sm text-muted-foreground mt-0.5">
                             {format(monthlyPrice * 12)} / year
                           </p>
                           <BilledInUsdNote />
                         </>
                       )}
                    </>
                  )}
                </div>

                {!isEnterprise && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {tier.seats} user licences · every Complete Bundle portal each
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                       {perUser != null
                         ? <>Equivalent to ~{format(perUser)}/user when shared across {tier.seats} licenses</>
                         : priceState}
                    </p>
                  </>
                )}

                {yearlySavings && yearlySavings > 0 && (
                  <p className="text-xs text-primary mt-3 mb-4">
                    Save {format(yearlySavings!)}/yr vs {tier.seats} individual Complete Bundle
                    subscriptions at {individualBundlePrice != null ? format(individualBundlePrice) : "the current Complete Bundle price"}/mo each
                  </p>
                )}
                {isEnterprise && <div className="mt-2 mb-4" />}

                <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/15">
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-xs font-semibold text-primary leading-snug">
                      {tier.headline}
                    </span>
                  </div>
                </div>

                {tier.includes && (
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                    Everything in <span className="text-foreground font-semibold">{tier.includes}</span>, plus:
                  </p>
                )}

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
                       disabled={loadingTier !== null || monthlyPrice == null || isPricesLoading}
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
          All corporate bundles are monthly starter packages — new advanced AI features added later are
charged pay-as-you-go based on usage. They include centralised billing and admin access. Need a custom seat
count, multi-entity setup or procurement terms?{" "}
          <a href={ENTERPRISE_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Talk to us on WhatsApp
          </a>
          .
        </p>
      </div>
    </section>
  );
}
