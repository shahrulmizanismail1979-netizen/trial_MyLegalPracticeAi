import { Button } from "@/components/ui/button";
import { ArrowRight, Scale, BookOpen, Shield, Building2, GraduationCap } from "lucide-react";
import { usePersona } from "@/lib/persona";

export function Hero() {
  const { persona } = usePersona();

  const scrollToPricing = () => {
    document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
  };

  const content = {
    practitioner: {
      tag: "For Law Firms & Practitioners",
      titleSuffix: "for Malaysian Legal Practitioners",
      desc: "The future of Malaysian legal practice is here. Seven AI-powered virtual paralegal assistants that help lawyers work faster, draft smarter, and navigate complex litigation and conveyancing matters with confidence.",
      icon1: <Scale className="h-6 w-6" />,
      title1: "Authority",
      desc1: "Built for the rigorous demands of Malaysian legal practice.",
    },
    inhouse: {
      tag: "For Corporate Legal Departments",
      titleSuffix: "for Malaysian In-House Counsel",
      desc: "The future of corporate legal work is here. Seven AI-powered virtual assistants that help in-house counsel and corporate secretaries manage compliance, draft agreements, and reduce business risk.",
      icon1: <Building2 className="h-6 w-6" />,
      title1: "Commercial Edge",
      desc1: "Practical advisory intelligence for business risk and compliance.",
    },
    academic: {
      tag: "For Law Faculties & Academics",
      titleSuffix: "for Malaysian Legal Academics",
      desc: "The future of legal education is here. AI-powered platforms that help law lecturers teach smarter, research faster, and prepare the next generation of practitioners using real-world simulation tools.",
      icon1: <GraduationCap className="h-6 w-6" />,
      title1: "Pedagogy",
      desc1: "Designed to enhance legal education and academic research.",
    },
    student: {
      tag: "For Law Students & Future Lawyers",
      titleSuffix: "for Malaysian Law Students",
      desc: "Your head start into the profession. AI-powered platforms that help law students master IRAC analysis, practise legal drafting on realistic scenarios, and prepare for exams and pupillage with real practice tools.",
      icon1: <BookOpen className="h-6 w-6" />,
      title1: "Learning Edge",
      desc1: "Practise on the same AI tools used in real Malaysian legal practice.",
    },
    judicial: {
      tag: "For Judicial Officers & Court Staff",
      titleSuffix: "for the Malaysian Judiciary",
      desc: "Research support for the bench. AI-powered platforms that help judicial officers analyse submissions, review case law across civil, criminal and syariah matters, and work through complex judgments faster.",
      icon1: <Scale className="h-6 w-6" />,
      title1: "Impartial Rigour",
      desc1: "Structured case-law analysis across every practice area.",
    },
    other: {
      tag: "For Everyone Working with Malaysian Law",
      titleSuffix: "for the Malaysian Legal Ecosystem",
      desc: "The future of Malaysian legal work is here. AI-powered platforms serving paralegals, researchers, journalists, and anyone who needs reliable, structured analysis of Malaysian law across every practice area.",
      icon1: <Shield className="h-6 w-6" />,
      title1: "Open Access",
      desc1: "Reliable legal intelligence, whatever your role in the ecosystem.",
    },
  };

  const activeContent = persona ? content[persona] : content.practitioner;

  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 lg:px-8 max-w-7xl mx-auto flex flex-col items-center text-center">
      <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          {activeContent.tag}
        </div>
        
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold tracking-tight mb-8 leading-[1.15]" style={{ textWrap: "balance" }}>
          AI Virtual Paralegals{" "}
          <span className="text-gradient-gold">{activeContent.titleSuffix}</span>
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
          {activeContent.desc} Curated by Prof. Madya Dr. Shahrul Mizan Ismail.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button 
            size="lg" 
            className="w-full sm:w-auto h-14 px-8 text-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-full shadow-[0_0_40px_rgba(99,149,224,0.25)] transition-all hover:shadow-[0_0_60px_rgba(99,149,224,0.40)] hover:scale-105"
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
            {activeContent.icon1}
          </div>
          <h3 className="font-serif text-xl font-medium">{activeContent.title1}</h3>
          <p className="text-sm text-muted-foreground">{activeContent.desc1}</p>
        </div>
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center text-primary">
            <BookOpen className="h-6 w-6" />
          </div>
          <h3 className="font-serif text-xl font-medium">Intelligence</h3>
          <p className="text-sm text-muted-foreground">AI-powered search and summarization for instant assistance.</p>
        </div>
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center text-primary">
            <Shield className="h-6 w-6" />
          </div>
          <h3 className="font-serif text-xl font-medium">Trust</h3>
          <p className="text-sm text-muted-foreground">Built on a curated legal knowledge base by subject-matter experts.</p>
        </div>
      </div>
    </section>
  );
}
