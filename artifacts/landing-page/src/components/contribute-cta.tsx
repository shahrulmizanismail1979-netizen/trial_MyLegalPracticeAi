import { FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ContributeCTA() {
  return (
    <section id="contribute" className="py-24 px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-background p-10 md:p-14">
        <div className="absolute top-0 right-0 h-40 w-40 bg-primary/10 blur-3xl rounded-full pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
            <FileText className="h-4 w-4" />
            Share documents — not money
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-6 max-w-4xl">
            Contribute cause papers and legal documents from your own practice
          </h2>
          <p className="text-muted-foreground text-lg mb-8 text-justify">
            This is not a request for donations. We are inviting practising lawyers to share
            soft copies of court cause papers and legal documents from their own legal
            practice — statements of claim, defences, affidavits, submissions, agreements, and
            similar materials. Every document you contribute is used to train and improve the
            AI Portals, so the apps become smarter, more accurate, and more useful to every
            lawyer who subscribes. Our team carefully reviews every contribution before it
            joins the knowledge base, so only accurate, relevant, and appropriately anonymised
            materials are adopted. The more real-world documents the AI learns from, the
            better it can assist you and fellow practitioners across Malaysia.
          </p>
          <Button size="lg" className="group" asChild>
            <a href={`${import.meta.env.BASE_URL}contribute`}>
              Contribute your documents
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
