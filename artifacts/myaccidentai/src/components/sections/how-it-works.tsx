import React from "react";
import { UserPlus, Search, FileEdit, Calculator, PlayCircle } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    title: "Access Platform",
    desc: "Login to your secure practitioner workspace."
  },
  {
    icon: Search,
    title: "Search & Research",
    desc: "Query the AI for cases and legal principles."
  },
  {
    icon: FileEdit,
    title: "Generate Documents",
    desc: "Draft precise cause papers and letters."
  },
  {
    icon: Calculator,
    title: "Calculate Damages",
    desc: "Assess general and special damages instantly."
  },
  {
    icon: PlayCircle,
    title: "Follow Workflows",
    desc: "Track case progress from intake to trial."
  }
];

export function HowItWorks() {
  return (
    <section className="py-24 bg-background border-t border-border/40 relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-64 bg-primary/5 blur-[100px] rounded-full pointer-events-none"></div>
      
      <div className="container px-4 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">How It Works</h2>
          <p className="text-muted-foreground text-lg">
            A seamless integration of legal research, drafting, and case management designed for the modern practitioner.
          </p>
        </div>

        <div className="relative">
          {/* Connecting Line */}
          <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary/20 to-transparent -translate-y-1/2 z-0"></div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 relative z-10">
            {steps.map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center group">
                <div className="w-16 h-16 rounded-full bg-card border border-primary/20 flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300 group-hover:bg-primary/10 group-hover:border-primary/50">
                  <step.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-serif font-semibold text-lg mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
                
                {/* Mobile connector */}
                {i < steps.length - 1 && (
                  <div className="md:hidden h-8 w-px bg-border/50 my-4"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
