import { HeartHandshake, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ContributeCTA() {
  return (
    <section id="contribute" className="py-24 px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-background p-10 md:p-14">
        <div className="absolute top-0 right-0 h-40 w-40 bg-primary/10 blur-3xl rounded-full pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
            <HeartHandshake className="h-4 w-4" />
            A shared cause for legal education
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
            Give back — help educate the next generation of Malaysian lawyers
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            Every document you share becomes part of a growing public good. By contributing
            your cause papers and legal materials, you help build AI tools that make quality
            legal knowledge accessible to students, pupils in chambers, and practitioners
            across Malaysia — especially those who need it most. It's a small act with a lasting
            impact on legal education and access to justice. Our team carefully reviews every
            contribution before it joins the shared knowledge base.
          </p>
          <Button size="lg" className="group" asChild>
            <a href={`${import.meta.env.BASE_URL}contribute`}>
              Contribute to the cause
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
