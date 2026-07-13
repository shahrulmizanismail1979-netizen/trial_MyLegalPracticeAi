import React from "react";
import { Car, HardHat, Footprints, HeartPulse, Shield, Skull, Route } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const areas = [
  {
    title: "Motor Vehicle Accidents",
    icon: Car,
    desc: "Comprehensive coverage of rear-end collisions, chain collisions, motorcycle accidents, and pedestrian claims. Includes principles on duty of care, standard of care, and res ipsa loquitur."
  },
  {
    title: "Workplace Injuries",
    icon: HardHat,
    desc: "Employer's liability, breach of statutory duty under OSHA 1994, safe system of work, and interplay with SOCSO claims."
  },
  {
    title: "Slip & Fall Cases",
    icon: Footprints,
    desc: "Occupier's liability, distinction between invitees and licensees, unusual dangers, and notice requirements."
  },
  {
    title: "Medical Negligence",
    icon: HeartPulse,
    desc: "Bolam test application, duty to warn of risks (Rogers v Whitaker), causation issues, and expert witness management."
  },
  {
    title: "Product Liability",
    icon: Shield,
    desc: "Claims under tort of negligence (Donoghue v Stevenson) and Consumer Protection Act 1999 for defective goods."
  },
  {
    title: "Fatal Accident Claims",
    icon: Skull,
    desc: "Dependency claims under Section 7 of Civil Law Act 1956, bereavement awards, and calculation of loss of support."
  },
  {
    title: "Running Down Matters",
    icon: Route,
    desc: "Specific procedures for insurance companies, declarations under Section 96 Road Transport Act, and third-party risks."
  }
];

export function PracticeAreas() {
  return (
    <section className="py-24 bg-card/20 relative">
      <div className="container px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">Specialized Practice Areas</h2>
          <p className="text-muted-foreground text-lg">
            Deep domain knowledge across all major categories of personal injury and tort claims in Malaysia.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {areas.map((area, i) => (
            <Card key={i} className="bg-background border-border/40 hover:border-primary/30 transition-colors shadow-sm group">
              <CardHeader className="pb-3">
                <div className="w-12 h-12 rounded-lg bg-primary/5 flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
                  <area.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg font-serif">{area.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {area.desc}
                </p>
              </CardContent>
            </Card>
          ))}
          
          <div className="hidden xl:flex items-center justify-center p-6 border border-dashed border-border/60 rounded-xl bg-muted/20">
            <p className="text-sm text-muted-foreground text-center italic font-serif">
              "The law of tort is never static. MyAccidentAi evolves with the common law."
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
