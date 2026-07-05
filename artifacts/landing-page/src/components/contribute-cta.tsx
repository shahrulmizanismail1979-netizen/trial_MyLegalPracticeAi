import { FileText, Gavel, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ContributeCTA() {
  return (
    <section id="contribute" className="py-24 px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center mb-14">
        <h2 className="text-3xl md:text-5xl font-serif font-bold mb-5">
          Need <span className="text-primary">Free Access</span>?
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Contribute your legal expertise and documents to the AI Portals knowledge base.
          Every approved contribution earns you free subscription time.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-background p-10 md:p-12 flex flex-col">
          <div className="absolute top-0 right-0 h-40 w-40 bg-primary/10 blur-3xl rounded-full pointer-events-none" />
          <div className="relative z-10 flex flex-col flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4 self-start">
              <FileText className="h-4 w-4" />
              Share documents — not money
            </div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold mb-5">
              Contribute cause papers and legal documents from your own practice
            </h2>
            <p className="text-muted-foreground mb-8 text-justify flex-1">
              This is not a request for donations. We are inviting practising lawyers to
              share soft copies of court cause papers and legal documents from their own
              legal practice — statements of claim, defences, affidavits, submissions,
              agreements, and similar materials. Every document you contribute is used to
              train and improve the AI Portals, so the apps become smarter, more accurate,
              and more useful to every lawyer who subscribes. Our team carefully reviews
              every contribution before it joins the knowledge base, so only accurate,
              relevant, and appropriately anonymised materials are adopted.{" "}
              <span className="text-foreground font-medium">
                And it pays you back: every approved contribution earns you a voucher for
                1 month free on any subscription.
              </span>
            </p>
            <Button size="lg" className="group self-start" asChild>
              <a href={`${import.meta.env.BASE_URL}contribute`}>
                Contribute your documents
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-background p-10 md:p-12 flex flex-col">
          <div className="absolute top-0 left-0 h-40 w-40 bg-primary/10 blur-3xl rounded-full pointer-events-none" />
          <div className="relative z-10 flex flex-col flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4 self-start">
              <Gavel className="h-4 w-4" />
              Build the case repository
            </div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold mb-5">
              Contribute a case judgment from your own legal practice
            </h2>
            <p className="text-muted-foreground mb-8 text-justify flex-1">
              Anyone can contribute — share written judgments and grounds of judgment from
              cases you have handled in your own legal practice. Every judgment you
              contribute is stored in the shared case repository used by all the AI Portals
              apps, giving every portal a growing library of real Malaysian case outcomes to
              draw on. Judgments are reviewed before they are added, and the richer the case
              repository becomes, the better every app can assist the lawyers who subscribe
              to it.{" "}
              <span className="text-foreground font-medium">
                Every approved judgment also earns you a voucher for 1 month free on any
                subscription.
              </span>
            </p>
            <Button size="lg" className="group self-start" asChild>
              <a href={`${import.meta.env.BASE_URL}contribute?type=judgment`}>
                Contribute a case judgment
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
