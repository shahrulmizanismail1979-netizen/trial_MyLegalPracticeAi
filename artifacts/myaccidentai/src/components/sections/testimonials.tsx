import React from "react";
import { Quote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const testimonials = [
  {
    quote: "MyAccidentAi has reduced my drafting and research time by at least 60%. The AI understands the nuances of Malaysian running down cases in a way generic tools simply don't. It's like having a dedicated pupil in chambers.",
    author: "Ahmad Fadzil",
    title: "Partner, Litigation Dept",
    firm: "Kuala Lumpur"
  },
  {
    quote: "The Damages Calculator is remarkably accurate. It pulls from recent Quantum cases and applies the correct multiplier automatically. I use it during settlement negotiations to quickly verify figures presented by the defence.",
    author: "Sarah Liew",
    title: "Senior Associate",
    firm: "Penang"
  },
  {
    quote: "As a solo practitioner, keeping up with the latest personal injury precedents was overwhelming. The AI Legal Assistant gives me authoritative answers with direct citations to the Civil Law Act and recent Federal Court decisions.",
    author: "R. Krishnan",
    title: "Principal",
    firm: "Johor Bahru"
  }
];

export function Testimonials() {
  return (
    <section className="py-24 bg-card/30 border-t border-border/40">
      <div className="container px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">Trusted by Practitioners</h2>
          <p className="text-muted-foreground text-lg">
            See how MyAccidentAi is transforming personal injury practices across Malaysia.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <Card key={i} className="bg-background border-border/40 relative overflow-hidden group hover:border-primary/30 transition-colors">
              <div className="absolute top-6 right-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <Quote className="h-16 w-16 text-primary" />
              </div>
              <CardContent className="p-8 relative z-10 flex flex-col h-full">
                <p className="text-foreground/80 italic leading-relaxed mb-8 flex-1">
                  "{t.quote}"
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold font-serif">
                    {t.author.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{t.author}</p>
                    <p className="text-xs text-muted-foreground">{t.title} • {t.firm}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
