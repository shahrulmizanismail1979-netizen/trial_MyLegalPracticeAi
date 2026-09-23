import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Shield, ArrowRight, Scale, CheckCircle2, ChevronDown, Landmark, Briefcase, Building, BookOpen, FileText, Gavel, Lock, Download } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const scrollToFeatures = () => {
    const el = document.getElementById("features");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/40 transition-all">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
              <Scale className="w-6 h-6 text-primary" />
            </div>
            <span className="font-serif text-2xl font-bold tracking-tight">MyCCBLit<span className="text-primary">AI</span></span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/access">
              <Button variant="ghost" className="hidden md:flex text-muted-foreground hover:text-foreground" data-testid="btn-login">
                Practitioner Login
              </Button>
            </Link>
            <Link href="/access">
              <Button className="font-medium" data-testid="btn-nav-enter">
                <Lock className="w-4 h-4 mr-2" /> Enter Workspace
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col">
        {/* Hero Section */}
        <section className="relative pt-40 pb-24 lg:pt-48 lg:pb-32 overflow-hidden flex items-center justify-center text-center">
          {/* Background elements */}
          <div className="absolute inset-0 bg-[url('/bg-pattern.svg')] bg-repeat opacity-20"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
          
          <div className="container mx-auto px-6 relative z-10">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-4xl mx-auto space-y-8 flex flex-col items-center"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium tracking-wide">
                <Shield className="w-4 h-4" />
                <span>Malaysian Corporate & Commercial Practice</span>
              </div>
              
              <h1 className="text-5xl md:text-7xl font-serif font-bold tracking-tight text-foreground leading-tight">
                Precision AI for <br/>
                <span className="gold-gradient-text">High-Stakes Litigation</span>
              </h1>
              
              <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                A premium workspace engineered for senior litigators handling complex corporate, commercial, and banking disputes.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 w-full">
                <Link href="/access" className="w-full sm:w-auto">
                  <Button size="lg" className="h-14 px-8 text-base font-semibold w-full shadow-lg shadow-primary/20 group" data-testid="btn-hero-enter">
                    Enter Workspace
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="h-14 px-8 text-base font-medium w-full sm:w-auto bg-background/50 backdrop-blur-sm border-border hover:bg-muted" onClick={scrollToFeatures}>
                  Explore Features
                </Button>
              </div>
              
              <div className="pt-16 flex flex-col items-center opacity-60 hover:opacity-100 transition-opacity cursor-pointer" onClick={scrollToFeatures}>
                <span className="text-xs font-semibold tracking-widest uppercase mb-2">Discover</span>
                <ChevronDown className="w-5 h-5 animate-bounce" />
              </div>
            </motion.div>
          </div>
        </section>

        {/* Coverage Badges */}
        <section className="py-12 border-y border-border/40 bg-muted/20">
          <div className="container mx-auto px-6 flex flex-wrap justify-center gap-4 md:gap-8">
            {[
              "Shareholder Disputes", "Contractual Breach", "Banking Litigation", 
              "Insolvency & Restructuring", "Corporate Fraud", "Intellectual Property",
              "Debt Recovery", "Directors' Duties"
            ].map(badge => (
              <div key={badge} className="px-4 py-2 rounded-lg bg-card border border-border/50 text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary/70" />
                {badge}
              </div>
            ))}
          </div>
        </section>

        {/* Three Pillars Section */}
        <section id="features" className="py-24 px-6 md:px-12 lg:py-32 bg-background relative z-10">
          <div className="container mx-auto">
            <div className="text-center mb-16 md:mb-24">
              <h2 className="text-3xl md:text-5xl font-serif font-bold mb-6">The Three Pillars of Practice</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Start with a dated chronology, the complete pleadings or facility and corporate documents, the parties' positions, relief sought and next deadline. Each pillar produces a working issue map, risk checklist or editable draft for counsel to reconcile against the record and verify under the governing law, current court rules and registry practice.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  title: "Corporate Litigation",
                  icon: Building,
                   desc: "Provide the constitution, registers, resolutions, ownership history, challenged conduct and relief sought. Review the resulting issues and draft against the complete company record, current legislation and the court's jurisdiction."
                },
                {
                  title: "Commercial Litigation",
                  icon: Briefcase,
                   desc: "Provide the full contract and schedules, communications, performance chronology, loss evidence and governing-law clause. Use the output as an editable claim or defence map, then test every assumption, remedy and cross-border point."
                },
                {
                  title: "Banking Litigation",
                  icon: Landmark,
                   desc: "Provide executed facilities, securities, statements, notices, payment history and enforcement stage. Reconcile figures and documents, then verify notice, forum, insolvency and enforcement requirements before action."
                }
              ].map((pillar, i) => (
                <div key={i} className="p-8 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-colors group">
                  <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                    <pillar.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-serif font-bold mb-3">{pillar.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{pillar.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AI Features Section */}
        <section className="py-24 relative bg-card/50">
          <div className="container mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
              >
                <h2 className="text-3xl md:text-5xl font-serif font-bold mb-6">AI-Driven Legal Intelligence</h2>
                <p className="text-lg text-muted-foreground mb-8">Reduce research hours and drafting time. Our AI models are fine-tuned on Malaysian case law and civil procedure rules to provide highly relevant, context-aware assistance.</p>
                
                <div className="space-y-6">
                  {[
                    { icon: FileText, title: "Automated Drafting", desc: "Generate precise statements of claim, affidavits, and written submissions." },
                    { icon: BookOpen, title: "Intelligent Case Research", desc: "Extract precedents and summarize complex judgments instantly." },
                    { icon: Shield, title: "Risk Assessment", desc: "Evaluate litigation risks and formulate strategic defenses." }
                  ].map((feature, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="mt-1">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <feature.icon className="w-5 h-5 text-primary" />
                        </div>
                      </div>
                      <div>
                        <h4 className="text-lg font-bold mb-1">{feature.title}</h4>
                        <p className="text-muted-foreground">{feature.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="relative"
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent rounded-2xl blur-2xl" />
                <div className="relative rounded-2xl border border-white/10 bg-background overflow-hidden shadow-2xl">
                  <div className="h-12 border-b border-white/5 bg-card/50 flex items-center px-4 gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-white/10" />
                      <div className="w-3 h-3 rounded-full bg-white/10" />
                      <div className="w-3 h-3 rounded-full bg-white/10" />
                    </div>
                    <div className="ml-4 text-xs text-muted-foreground font-mono">myccblitai-workspace</div>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      <div className="h-4 w-1/3 bg-white/5 rounded" />
                      <div className="h-4 w-full bg-white/5 rounded" />
                      <div className="h-4 w-5/6 bg-white/5 rounded" />
                      <div className="h-4 w-4/6 bg-white/5 rounded" />
                      <div className="py-4">
                        <div className="h-px w-full bg-white/5" />
                      </div>
                      <div className="flex gap-3">
                        <div className="h-10 w-24 bg-primary/20 rounded border border-primary/30" />
                        <div className="h-10 w-32 bg-white/5 rounded" />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Stats & Trust */}
        <section className="py-24 px-6 md:px-12 border-t border-border/40 bg-[url('/bg-pattern.svg')] bg-repeat relative">
          <div className="absolute inset-0 bg-background/90 backdrop-blur-md"></div>
          <div className="max-w-5xl mx-auto relative z-10 text-center">
            <h2 className="text-2xl md:text-3xl font-serif font-bold mb-12">Developed by legal experts, for legal experts</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
              {[
                { label: "AI Models", value: "3+" },
                { label: "Legal Tools", value: "20+" },
                { label: "Time Saved", value: "60%" },
                { label: "Uptime", value: "99.9%" }
              ].map((stat, i) => (
                <div key={i} className="flex flex-col items-center">
                  <span className="text-4xl md:text-5xl font-serif font-bold text-primary mb-2">{stat.value}</span>
                  <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                </div>
              ))}
            </div>

            <div className="p-8 rounded-2xl bg-muted/30 border border-border/50 max-w-3xl mx-auto text-left">
              <div className="flex items-start gap-4">
                <Scale className="w-8 h-8 text-primary flex-shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    This platform bridges the gap between cutting-edge artificial intelligence and the rigorous demands of Malaysian legal practice, establishing a new standard for computational law.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 relative overflow-hidden border-t border-border">
          <div className="absolute inset-0 bg-primary/5" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background" />
          
          <div className="container mx-auto px-6 relative z-10 text-center">
            <Gavel className="w-16 h-16 text-primary mx-auto mb-8" />
            <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6">Elevate Your Litigation Practice</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Join leading practitioners leveraging AI to deliver superior outcomes in complex corporate and commercial disputes.
            </p>
            <Link href="/access">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-10 text-lg font-medium" data-testid="btn-enter-suite-bottom">
                Enter Workspace
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-12 px-6 md:px-12 text-center md:text-left">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-sm bg-primary/20 border border-primary/50 flex items-center justify-center">
              <span className="font-serif font-bold text-primary text-[10px]">CCB</span>
            </div>
            <span className="font-serif font-bold tracking-tight">MyCCBLit<span className="text-primary">AI</span></span>
          </div>
          
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Faculty of Law, Universiti Kebangsaan Malaysia. All rights reserved.
          </p>
          
          <div className="flex items-center gap-4">
            <Link href="/access" className="text-sm text-muted-foreground hover:text-primary transition-colors">Access</Link>
            <span className="text-muted-foreground/30">•</span>
            <span className="text-sm text-muted-foreground">Authorized Use Only</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
