import { Check, Building2, Building, Briefcase, Crown } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const tiers = [
  {
    name: "Boutique",
    icon: Briefcase,
    description: "Small firms & chambers",
    licenses: "5 user licenses",
    monthlyPrice: "$40",
    price: "$475",
    perUser: "$8 per user / month · $95 per user / year",
    savings: "Save $965 vs individual",
    features: [
      "Access to all 7 AI Portals",
      "5 user licenses",
      "Annual or monthly subscription",
      "Centralised billing",
      "Email support",
    ],
  },
  {
    name: "Practice",
    icon: Building,
    description: "Mid-sized law firms",
    licenses: "15 user licenses",
    monthlyPrice: "$100",
    price: "$1,215",
    perUser: "$7 per user / month · $81 per user / year",
    savings: "Save $3,095 vs individual",
    featured: true,
    features: [
      "Access to all 7 AI Portals",
      "15 user licenses",
      "Annual or monthly subscription",
      "Centralised billing & admin",
      "Priority support",
      "Onboarding session included",
    ],
  },
  {
    name: "Firm",
    icon: Building2,
    description: "Large firms & legal departments",
    licenses: "30 user licenses",
    monthlyPrice: "$180",
    price: "$2,160",
    perUser: "$6 per user / month · $72 per user / year",
    savings: "Save $6,445 vs individual",
    features: [
      "Access to all 7 AI Portals",
      "30 user licenses",
      "Annual or monthly subscription",
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
    licenses: "Custom licensing",
    price: "Custom",
    perUser: "Volume pricing",
    savings: "Tailored to your needs",
    features: [
      "Access to all 7 AI Portals",
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

export function FirmBundles() {
  const scrollToPayment = () => {
    document.getElementById("payment")?.scrollIntoView({ behavior: "smooth" });
  };

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
          Equip your entire firm or legal department with all 7 AI Portals. Volume pricing,
          centralised billing, and priority support — scaled to fit your team.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {tiers.map((tier) => {
          const Icon = tier.icon;
          const isEnterprise = tier.name === "Enterprise";
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
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold text-foreground">{tier.price}</span>
                    {tier.price !== "Custom" && (
                      <span className="text-sm text-muted-foreground">/year</span>
                    )}
                  </div>
                  {tier.monthlyPrice && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      or {tier.monthlyPrice} / month
                    </p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-1">{tier.perUser}</p>
                <p className="text-xs text-primary mb-6">{tier.savings}</p>

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
          All firm bundles are annual or monthly starter packages — new advanced AI features added later are
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
