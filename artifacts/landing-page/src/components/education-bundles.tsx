import { Check, GraduationCap, BookOpen, School, Library, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const tiers = [
  {
    name: "Faculty Starter",
    icon: BookOpen,
    description: "Small law faculties & departments",
    licenses: "20 student/lecturer licenses",
    monthlyPrice: "$125",
    price: "$1,540",
    perUser: "$6 per user / month · $77 per user / year",
    savings: "Save $4,215 vs individual",
    headline: "Foundational classroom access for small cohorts",
    includes: null,
    features: [
      "Access to all 7 AI Portals",
      "MyLawSimEduAi simulation platform included",
      "20 user licenses",
      "Annual or monthly academic subscription",
      "For students & lecturers",
      "Email support",
    ],
  },
  {
    name: "Faculty Plus",
    icon: School,
    description: "Mid-sized law schools",
    licenses: "50 student/lecturer licenses",
    monthlyPrice: "$270",
    price: "$3,250",
    perUser: "$5 per user / month · $65 per user / year",
    savings: "Save $11,170 vs individual",
    featured: true,
    headline: "Adds lecturer onboarding & priority support",
    includes: "Faculty Starter",
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
    licenses: "150 user licenses",
    monthlyPrice: "$635",
    price: "$7,650",
    perUser: "$4 per user / month · $51 per user / year",
    savings: "Save $35,425 vs individual",
    headline: "Adds library-wide access & dedicated training",
    includes: "Faculty Plus",
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
    licenses: "Custom seat count",
    price: "Custom",
    perUser: "Volume academic pricing",
    savings: "Tailored to your institution",
    headline: "Adds multi-campus deployment, SSO & API access",
    includes: "Campus",
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

export function EducationBundles() {
  const scrollToPayment = () => {
    document.getElementById("payment")?.scrollIntoView({ behavior: "smooth" });
  };

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
          legal simulation platform — bundled together with all 7 AI Portals for both students
          and lecturers.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {tiers.map((tier) => {
          const Icon = tier.icon;
          const isInstitution = tier.name === "Institution";
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
                    <span className="text-3xl font-bold text-foreground">{tier.monthlyPrice || tier.price}</span>
                    {tier.monthlyPrice && (
                      <span className="text-sm text-muted-foreground">/month</span>
                    )}
                    {!tier.monthlyPrice && tier.price !== "Custom" && (
                      <span className="text-sm text-muted-foreground">/year</span>
                    )}
                  </div>
                  {tier.monthlyPrice && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {tier.price} / year
                    </p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-1">{tier.perUser}</p>
                <p className="text-xs text-primary mb-4">{tier.savings}</p>

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
          All academic bundles are annual or monthly starter packages — new advanced AI features added later are
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
