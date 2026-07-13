import { Check, Building2, Factory, Briefcase, Crown, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/lib/currency";
import { BilledInUsdNote } from "@/components/currency-selector";

const INDIVIDUAL_BUNDLE_PRICE = 79;

const tiers = [
  {
    name: "Startup Legal",
    icon: Briefcase,
    description: "SMEs & startup in-house teams",
    seats: 3,
    monthlyPrice: 213,
    headline: "Foundational corporate-advisory toolkit",
    includes: null,
    features: [
      "Access to all 7 AI Portals",
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
    monthlyPrice: 552,
    featured: true,
    headline: "Adds compliance + AI advisory assistant",
    includes: "Startup Legal",
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
    monthlyPrice: 1300,
    headline: "Adds board, M&A & due diligence modules",
    includes: "Growth",
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
    monthlyPrice: null,
    headline: "Adds ESG, group governance & cross-border mapping",
    includes: "Corporate",
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

export function CorporateBundles() {
  const { format } = useCurrency();
  const scrollToPayment = () => {
    document.getElementById("payment")?.scrollIntoView({ behavior: "smooth" });
  };

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

          const perUser = tier.seats && tier.monthlyPrice
            ? Math.round((tier.monthlyPrice / tier.seats) * 100) / 100
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
                  ? "border-primary shadow-[0_0_30px_rgba(212,175,55,0.15)] bg-card relative"
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
                      {tier.seats} user licenses · all 7 portals each
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Equivalent to ~{format(perUser!)}/user when shared across {tier.seats} licenses
                    </p>
                  </>
                )}

                {yearlySavings && yearlySavings > 0 && (
                  <p className="text-xs text-primary mt-3 mb-4">
                    Save {format(yearlySavings!)}/yr vs {tier.seats} individual Complete Bundle
                    subscriptions at {format(INDIVIDUAL_BUNDLE_PRICE)}/mo each
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

                <ul className="space-y-3 mb-6 flex-1">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground/80">{feature}</span>
                    </li>
                  ))}
                </ul>
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
                  <Button
                    variant={tier.featured ? "default" : "outline"}
                    className={`w-full ${
                      tier.featured ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""
                    }`}
                    onClick={scrollToPayment}
                  >
                    Get This Bundle
                  </Button>
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
