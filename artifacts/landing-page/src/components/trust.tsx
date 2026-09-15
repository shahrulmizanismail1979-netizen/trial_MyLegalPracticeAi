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
          Trusted by <span className="text-primary">Malaysian Legal Professionals</span>
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto text-justify">
          AI Portals is built on deep Malaysian legal expertise, curated by a practitioner with decades of hands-on experience in the profession.
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
                Every AI Portal is built around curated materials drawn from Malaysian statutes, case law, procedural rules, and practice guides. Content is structured to support professional legal practice, not general-purpose answers. Users must independently verify all legal authorities and AI outputs before reliance.
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
    </section>
  );
}
