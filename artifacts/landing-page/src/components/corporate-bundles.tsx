import { Check, Building2, Factory, Briefcase, Crown } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const tiers = [
  {
    name: "Startup Legal",
    icon: Briefcase,
    description: "SMEs & startup in-house teams",
    licenses: "3 user licenses",
    price: "RM2,100",
    perUser: "RM700 per user",
    savings: "Save RM600 vs individual",
    features: [
      "Access to all 7 AI Web Books",
      "3 user licenses",
      "3-year subscription",
      "Centralised billing",
      "Email support",
    ],
  },
  {
    name: "Growth",
    icon: Building2,
    description: "Growing companies & in-house counsel",
    licenses: "8 user licenses",
    price: "RM4,800",
    perUser: "RM600 per user",
    savings: "Save RM2,400 vs individual",
    featured: true,
    features: [
      "Access to all 7 AI Web Books",
      "8 user licenses",
      "3-year subscription",
      "Centralised billing & admin",
      "Priority support",
      "Onboarding session included",
    ],
  },
  {
    name: "Corporate",
    icon: Factory,
    description: "GLCs & large corporations",
    licenses: "20 user licenses",
    price: "RM10,000",
    perUser: "RM500 per user",
    savings: "Save RM8,000 vs individual",
    features: [
      "Access to all 7 AI Web Books",
      "20 user licenses",
      "3-year subscription",
      "Dedicated account manager",
      "Priority support",
      "Onboarding & training session",
      "Quarterly check-ins",
    ],
  },
  {
    name: "Group / Enterprise",
    icon: Crown,
    description: "Conglomerates & multi-entity groups",
    licenses: "Custom licensing",
    price: "Custom",
    perUser: "Volume pricing",
    savings: "Tailored to your group",
    features: [
      "Access to all 7 AI Web Books",
      "30+ user licenses",
      "Multi-entity / subsidiary access",
      "Flexible subscription terms",
      "Dedicated account manager",
      "Custom onboarding & training",
      "SLA & white-glove support",
    ],
  },
];

export function CorporateBundles() {
  const scrollToPayment = () => {
    document.getElementById("payment")?.scrollIntoView({ behavior: "smooth" });
  };

  const whatsappEnterprise = () => {
    const message = encodeURIComponent(
      "Hi, I'd like to discuss group/enterprise licensing of the AI Web Books for our company."
    );
    window.open(`https://wa.me/60173678484?text=${message}`, "_blank");
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
          Purpose-built bundles for company secretaries, in-house counsel and compliance teams.
          Centralised billing, volume pricing, and priority support across your organisation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {tiers.map((tier) => {
          const Icon = tier.icon;
          const isEnterprise = tier.name === "Group / Enterprise";
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
                  <span className="text-3xl font-bold text-foreground">{tier.price}</span>
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
                <Button
                  variant={tier.featured ? "default" : "outline"}
                  className={`w-full ${
                    tier.featured ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""
                  }`}
                  onClick={isEnterprise ? whatsappEnterprise : scrollToPayment}
                >
                  {isEnterprise ? "Contact Sales" : "Get This Bundle"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <div className="mt-12 text-center max-w-3xl mx-auto">
        <p className="text-sm text-muted-foreground">
          All corporate bundles include centralised billing and admin access. Need a custom seat
          count, multi-entity setup or procurement terms?{" "}
          <button onClick={whatsappEnterprise} className="text-primary hover:underline">
            Talk to us on WhatsApp
          </button>
          .
        </p>
      </div>
    </section>
  );
}
