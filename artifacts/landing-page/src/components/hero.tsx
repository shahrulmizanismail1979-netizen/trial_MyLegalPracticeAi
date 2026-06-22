import { Button } from "@/components/ui/button";
import { ArrowRight, Scale, BookOpen, Shield } from "lucide-react";

export function Hero() {
  const scrollToPricing = () => {
    document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 lg:px-8 max-w-7xl mx-auto flex flex-col items-center text-center">
      <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          Malaysia's First AI-Enhanced Legal Reference Platform
        </div>
        
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold tracking-tight mb-8 leading-[1.1]">
          The Future of <br className="hidden md:block" />
          <span className="text-gradient-gold">Legal Practice</span>
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
          Seven AI-powered interactive reference AI Portals for Malaysian professionals. 
          Instant, intelligent access to legal knowledge for lawyers, corporate secretaries, and practitioners.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button 
            size="lg" 
            className="w-full sm:w-auto h-14 px-8 text-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-full shadow-[0_0_40px_rgba(212,175,55,0.3)] transition-all hover:shadow-[0_0_60px_rgba(212,175,55,0.5)] hover:scale-105"
            onClick={scrollToPricing}
          >
            Secure Your Access
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button 
            size="lg" 
            variant="outline" 
            className="w-full sm:w-auto h-14 px-8 text-lg border-border hover:bg-secondary rounded-full"
            onClick={() => document.getElementById("apps")?.scrollIntoView({ behavior: "smooth" })}
          >
            Explore the AI Portals
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300 w-full max-w-4xl border-t border-border/50 pt-12">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center text-primary">
            <Scale className="h-6 w-6" />
          </div>
          <h3 className="font-serif text-xl font-medium">Authority</h3>
          <p className="text-sm text-muted-foreground">Built for the rigorous demands of Malaysian legal practice.</p>
        </div>
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center text-primary">
            <BookOpen className="h-6 w-6" />
          </div>
          <h3 className="font-serif text-xl font-medium">Intelligence</h3>
          <p className="text-sm text-muted-foreground">AI-powered search and summarization for instant reference.</p>
        </div>
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center text-primary">
            <Shield className="h-6 w-6" />
          </div>
          <h3 className="font-serif text-xl font-medium">Trust</h3>
          <p className="text-sm text-muted-foreground">Curated knowledge from Shahrul Mizan's expert collection.</p>
        </div>
      </div>
    </section>
  );
}