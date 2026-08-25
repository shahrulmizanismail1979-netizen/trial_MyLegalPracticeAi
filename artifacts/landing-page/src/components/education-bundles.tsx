import { Check, GraduationCap, BookOpen, School, Library, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/lib/currency";
import { useBundleCheckout } from "@/lib/use-bundle-checkout";
import { BilledInUsdNote } from "@/components/currency-selector";
import { ComplimentaryPerks } from "@/components/complimentary-perks";
import { getCatalogUsdAmount, useStripeCatalogPrices } from "@/lib/stripe-catalog-prices";

const tiers = [
  {
    name: "Faculty Starter",
    icon: BookOpen,
    description: "Small law faculties & departments",
    seats: 20,
    catalogTier: "edu-faculty-starter" as const,
    headline: "Foundational classroom access for small cohorts",
    includes: null,
    solarKwp: null as number | null,
    features: [
      "Access to every portal included in the Complete Bundle",
      "MyLawSimEduAi simulation platform included",
      "20 user licenses",
      "Monthly academic subscription — cancel anytime",
      "For students & lecturers",
      "Email support",
    ],
  },
  {
    name: "Faculty Plus",
    icon: School,
    description: "Mid-sized law schools",
    seats: 50,
    catalogTier: "edu-faculty-plus" as const,
    featured: true,
    headline: "Adds lecturer onboarding & priority support",
    includes: "Faculty Starter",
    solarKwp: 4,
    features: [
      "Upgraded to 50 user licenses",
      "Lecturer onboarding session",
      "Lecturer-only teaching resources",
      "Priority support",
    ],
  },
  {
    name: "Campus",
    icon: Library,
    description: "Large universities & colleges",
    seats: 150,
    catalogTier: "edu-campus" as const,
    headline: "Adds library-wide access & dedicated training",
    includes: "Faculty Plus",
    solarKwp: 7,
    features: [
      "Upgraded to 150 user licenses",
      "Library & faculty-wide access",
      "Lecturer training session (full faculty)",
      "Dedicated account manager",
      "LMS integration support",
    ],
  },
  {
    name: "Institution",
    icon: GraduationCap,
    description: "Multi-campus & nationwide programmes",
    seats: null,
    catalogTier: null,
    headline: "Adds multi-campus deployment, SSO & API access",
    includes: "Campus",
    solarKwp: 9.45,
    features: [
      "Unlimited or custom seat count",
      "Multi-year academic terms",
      "Multi-campus deployment",
      "SSO & API integration",
      "Custom onboarding & training",
    ],
  },
];

const INSTITUTION_WHATSAPP_URL = `https://wa.me/60139725475?text=${encodeURIComponent("Hi, I'm enquiring about the Institution academic bundle for my institution.")}`;
const EDUCATION_WHATSAPP_URL = `https://wa.me/60139725475?text=${encodeURIComponent("Hi, I'd like to discuss academic licensing for the AI Portals for my college/university.")}`;

const CHECKOUT_TIER_BY_NAME: Record<string, string> = {
  "Faculty Starter": "edu-faculty-starter",
  "Faculty Plus": "edu-faculty-plus",
  Campus: "edu-campus",
};

export function EducationBundles() {
  const { format } = useCurrency();
  const { prices, isLoading: isPricesLoading } = useStripeCatalogPrices();
  const { startCheckout, loadingTier } = useBundleCheckout();
  const individualBundlePrice = getCatalogUsdAmount(prices, "bundle");
  const bundleWhatsAppUrl = (tierName: string) =>
    `https://wa.me/60139725475?text=${encodeURIComponent(
      `Hi, I'd like to subscribe to the ${tierName} academic bundle. Please help me get set up.`,
    )}`;

  return (
    <section id="education-bundles" className="py-24 px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
          <GraduationCap className="h-4 w-4" />
          For Colleges & Universities
        </div>
        <h2 className="text-3xl md:text-5xl font-serif font-bold mb-6">
          Academic <span className="text-primary">Bundles</span> for Law Faculties
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Empower the next generation of Malaysian legal practitioners. Every academic bundle
comes with <span className="text-primary font-medium">MyLawSimEduAi</span> — our AI-powered
legal simulation platform — bundled together with every portal included in the Complete Bundle for both students
and lecturers.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {tiers.map((tier) => {
          const Icon = tier.icon;
          const isInstitution = tier.name === "Institution";
          const monthlyPrice = tier.catalogTier
            ? getCatalogUsdAmount(prices, tier.catalogTier)
            : null;
          const priceState = isPricesLoading
            ? "Loading price…"
            : monthlyPrice == null && !isInstitution
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
                  {isInstitution ? (
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

                {!isInstitution && (
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
                {isInstitution && <div className="mt-2 mb-4" />}

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
                {isInstitution ? (
                  <a
                    href={INSTITUTION_WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full"
                  >
                    <Button variant="outline" className="w-full">
                      Contact Us
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
          All academic bundles are monthly starter packages — new advanced AI features added later are
charged pay-as-you-go based on usage. Academic bundles require verification of institutional status. Need a different seat
count or longer term?{" "}
          <a href={EDUCATION_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Talk to us on WhatsApp
          </a>
          .
        </p>
      </div>
    </section>
  );
}
