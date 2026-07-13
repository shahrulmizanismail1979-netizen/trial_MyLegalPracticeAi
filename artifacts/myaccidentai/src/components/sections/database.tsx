import React, { useState } from "react";
import { BookOpen, Scale, FileText, Activity, FileStack, BadgeInfo, ShieldAlert, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const features = [
  {
    title: "Theory Topics",
    count: "25+",
    icon: BookOpen,
    description: "Comprehensive breakdown of legal principles and doctrines in personal injury law.",
    sample: {
      title: "Contributory Negligence in Motor Vehicle Accidents",
      content: "Contributory negligence arises when the plaintiff's own negligence contributed to the damage suffered. Under Section 12(1) of the Civil Law Act 1956, where any person suffers damage as the result partly of his own fault and partly of the fault of any other person, a claim in respect of that damage shall not be defeated by reason of the fault of the person suffering the damage, but the damages recoverable in respect thereof shall be reduced to such extent as the Court thinks just and equitable having regard to the claimant's share in the responsibility for the damage."
    }
  },
  {
    title: "Case Laws",
    count: "120+",
    icon: Scale,
    description: "Curated database of landmark and recent Malaysian court decisions.",
    sample: {
      title: "Sivamani v Valliammal [1965] 1 MLJ 240",
      content: "The duty of care owed by a driver. The Federal Court held that a driver of a motor vehicle owes a duty of care to other road users, including pedestrians. The standard of care is that of a reasonable and prudent driver. Failure to keep a proper lookout or maintain control of the vehicle constitutes a breach of this duty."
    }
  },
  {
    title: "Cause Papers",
    count: "75+",
    icon: FileText,
    description: "Template pleadings, affidavits, and applications ready for adaptation.",
    sample: {
      title: "Statement of Claim (Motor Vehicle Accident)",
      content: "1. The Plaintiff is at all material times a student residing at... 2. The Defendant was at all material times the registered owner and/or driver of the motorcar bearing registration number... 3. On or about [Date] at about [Time], the Plaintiff was riding his motorcycle bearing registration number... along [Road Name] when the Defendant, who was driving the said motorcar along the same road, negligently and/or recklessly collided into the rear of the Plaintiff's motorcycle."
    }
  },
  {
    title: "Workflows",
    count: "20+",
    icon: Activity,
    description: "Step-by-step procedural guides from client intake to trial.",
    sample: {
      title: "Filing a Personal Injury Claim",
      content: "Phase 1: Pre-Litigation (0-3 Months)\n- Initial Client Consultation & Retainer\n- Obtain Police Report & Sketch Plan\n- Request Initial Medical Report\n- Issue Notice of Demand (NOD)\n\nPhase 2: Pleadings (3-6 Months)\n- File Writ of Summons & Statement of Claim\n- Serve Writ on Defendant\n- Receive Memorandum of Appearance\n- Receive Statement of Defence"
    }
  },
  {
    title: "Sample Documents",
    count: "50+",
    icon: FileStack,
    description: "Letters, notices, and correspondence templates for daily practice.",
    sample: {
      title: "Notice of Demand (Section 96 Road Transport Act 1987)",
      content: "We act for [Client Name] who was involved in a motor vehicle accident on [Date] at [Location] involving your insured vehicle bearing registration number [Reg No]. Take notice that our client holds your insured responsible for the said accident. Pursuant to Section 96 of the Road Transport Act 1987, we hereby give you notice of our client's intention to commence legal proceedings against your insured."
    }
  },
  {
    title: "Costs & Fees",
    count: "Comprehensive",
    icon: BadgeInfo,
    description: "Guidelines and calculators for party-and-party costs and filing fees.",
    sample: {
      title: "Getting Up Costs (Subordinate Courts)",
      content: "Order 59 Rule 22 of the Rules of Court 2012 provides guidelines for basic costs. For a running down matter in the Sessions Court where damages assessed are between RM50,000 to RM100,000, the getting up fee is typically assessed at RM4,000 to RM8,000 depending on the complexity of the trial, number of witnesses called, and days of trial."
    }
  },
  {
    title: "Glossary Terms",
    count: "110+",
    icon: ShieldAlert,
    description: "Definitions of medical and legal terminology common in injury claims.",
    sample: {
      title: "Loss of Amenities of Life",
      content: "A head of general damages awarded to compensate a plaintiff for the deprivation of the ability to participate in normal activities and enjoy life to the extent that they could before the injury. This includes inability to play sports, pursue hobbies, or enjoy a normal family life. Often awarded alongside pain and suffering as a single global sum."
    }
  }
];

export function Database() {
  const [selectedFeature, setSelectedFeature] = useState<typeof features[0] | null>(null);

  return (
    <section id="database" className="py-24 bg-card/30 relative">
      <div className="container px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">Comprehensive Legal Database</h2>
          <p className="text-muted-foreground text-lg">
            Access thousands of curated legal resources, meticulously organized for Malaysian personal injury practitioners.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <Card 
              key={i} 
              className="bg-card/50 border-border/50 hover:border-primary/50 transition-all cursor-pointer hover-elevate group"
              onClick={() => setSelectedFeature(feature)}
              data-testid={`card-feature-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground bg-background px-2 py-1 rounded-full border border-border">
                    {feature.count}
                  </span>
                </div>
                <CardTitle className="text-xl group-hover:text-primary transition-colors">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
          
          <Card className="bg-primary/5 border-primary/20 flex flex-col justify-center items-center text-center p-6 h-full min-h-[200px]">
            <div className="rounded-full bg-primary/20 p-4 mb-4">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">And much more...</h3>
            <p className="text-sm text-muted-foreground">Continuously updated with new authorities and precedents.</p>
          </Card>
        </div>
      </div>

      <Dialog open={!!selectedFeature} onOpenChange={(open) => !open && setSelectedFeature(null)}>
        <DialogContent className="sm:max-w-2xl border-border bg-card">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              {selectedFeature && <selectedFeature.icon className="h-5 w-5 text-primary" />}
              <DialogTitle className="text-xl font-serif">{selectedFeature?.title} Preview</DialogTitle>
            </div>
            <DialogDescription>
              Sample content from the MyAccidentAi database.
            </DialogDescription>
          </DialogHeader>
          
          {selectedFeature && (
            <div className="mt-4 p-6 rounded-md bg-background border border-border/50 max-h-[60vh] overflow-y-auto">
              <h4 className="text-lg font-semibold text-foreground mb-4">{selectedFeature.sample.title}</h4>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {selectedFeature.sample.content}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
