import { Award, BookOpen, Mail, MessageCircle, Scale, Users } from "lucide-react";

export function Trust() {
  return (
    <section id="about" className="py-24 px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
          <Award className="h-4 w-4" />
          About &amp; Credentials
        </div>
        <h2 className="text-3xl md:text-5xl font-serif font-bold mb-6">
          Built for <span className="text-primary">Malaysian Legal Work</span>
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto text-justify">
          LAWYes combines practitioner-led curation with a review-first workflow. It is designed to help professionals organise work, not to replace their responsibility for the file, current law, procedure, or final advice.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start mb-16">
        <div className="space-y-8">
          <div className="flex gap-5">
            <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-1">
              <Scale className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-semibold mb-2">Founder &amp; Curator</h3>
              <p className="text-muted-foreground leading-relaxed text-justify">
                <strong className="text-foreground">Prof. Madya Dr. Shahrul Mizan Ismail</strong> is an Associate Professor of Law at Universiti Kebangsaan Malaysia (UKM) and the founder of AI Portals. Called to the Malaysian Bar in April 2004, he brings over two decades of experience at the Bar and in the academy, working at the confluence of human rights jurisprudence, civil litigation, and the future of legal practice. He personally curates and oversees the knowledge base powering each portal — ensuring accuracy, relevance, and practical value for practitioners on the ground. Learn more at{" "}
                <a href="https://shahrulmizan.life" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">shahrulmizan.life</a>.
              </p>
            </div>
          </div>

          <div className="flex gap-5">
            <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-1">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-semibold mb-2">Editorial Methodology</h3>
              <p className="text-muted-foreground leading-relaxed text-justify">
                 Portal material is organised for Malaysian professional contexts rather than general-purpose questions. Research source status matters: reviewed library material and separately selected public-web material must remain distinguishable. Users must trace propositions to sources and independently verify authorities, quotations, law, procedure, dates, and suitability before reliance.
              </p>
            </div>
          </div>

          <div className="flex gap-5">
            <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-1">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-semibold mb-2">Who We Serve</h3>
              <p className="text-muted-foreground leading-relaxed text-justify">
                AI Portals serves advocates &amp; solicitors, syarie lawyers, corporate secretaries, conveyancers, criminal law practitioners, in-house legal teams, and law students across Malaysia. The platform is designed exclusively for the Malaysian legal ecosystem, covering Malaysian statutes, courts, and practice norms.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 space-y-6">
          <h3 className="font-serif text-2xl font-semibold mb-6">Contact &amp; Support</h3>

          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">WhatsApp Support</p>
                <a
                  href="https://wa.me/60139725475"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  +60 13-972 5475
                </a>
                <p className="text-sm text-muted-foreground mt-1">Payment confirmation, subscription queries, and general support</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Email</p>
                <a
                  href="mailto:shahrulmizan@ukm.edu.my"
                  className="text-primary hover:underline"
                >
                  shahrulmizan@ukm.edu.my
                </a>
                <p className="text-sm text-muted-foreground mt-1">Billing, enterprise inquiries, and institutional licensing</p>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <p className="text-sm text-muted-foreground leading-relaxed text-justify">
              <strong className="text-foreground">LAWYes</strong> is a Malaysian legal-tech brand operated by Shahrul Mizan Ismail. Registered and operating in Malaysia. All subscriptions are governed by our{" "}
                <a href="/apps#terms" className="text-primary hover:underline">Terms of Service</a>
              {" "}and{" "}
                <a href="/apps#privacy" className="text-primary hover:underline">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-5 rounded-2xl border border-border bg-card/50 p-6 md:grid-cols-3">
        <div>
          <h3 className="font-semibold text-foreground">Before the task</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Define the audience, purpose, jurisdiction, stage, output, source set, and matters the assistant must not assume.</p>
        </div>
        <div>
          <h3 className="font-semibold text-foreground">During review</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Separate file facts, client instructions, legal propositions, calculations, and recommendations. Check each category against its proper source.</p>
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Before use</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Apply professional judgment, current authoritative material, confidentiality controls, document standards, and the responsible reviewer’s approval.</p>
        </div>
      </div>
    </section>
  );
}
