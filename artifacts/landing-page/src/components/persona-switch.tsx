import { useState, useEffect } from "react";
import { BookOpen, Building2, Gavel, GraduationCap, Scale, Settings2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePersona } from "@/lib/persona";

export function PersonaSwitcher() {
  const { persona, setPersona } = usePersona();
  const [isOpen, setIsOpen] = useState(false);

  // Close when scrolling to avoid being annoying
  useEffect(() => {
    const handleScroll = () => {
      if (isOpen) setIsOpen(false);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isOpen]);

  const currentLabel =
    persona === "practitioner" ? "Practitioner Mode" :
    persona === "inhouse" ? "In-House Mode" :
    persona === "academic" ? "Academic Mode" :
    persona === "student" ? "Student Mode" :
    persona === "judicial" ? "Judicial Mode" :
    persona === "other" ? "General Mode" :
    "Choose Your Mode";

  const Icon =
    persona === "practitioner" ? Scale :
    persona === "inhouse" ? Building2 :
    persona === "academic" ? GraduationCap :
    persona === "student" ? BookOpen :
    persona === "judicial" ? Gavel :
    persona === "other" ? Users :
    Settings2;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 p-2 bg-card border border-border shadow-xl rounded-xl w-64 animate-in slide-in-from-bottom-2 fade-in duration-200">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-2 pt-2">
            Switch Professional Mode
          </div>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => { setPersona("practitioner"); setIsOpen(false); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                persona === "practitioner" ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary text-foreground"
              }`}
            >
              <Scale className="h-4 w-4" /> Legal Practitioner
            </button>
            <button
              onClick={() => { setPersona("inhouse"); setIsOpen(false); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                persona === "inhouse" ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary text-foreground"
              }`}
            >
              <Building2 className="h-4 w-4" /> In-House Counsel
            </button>
            <button
              onClick={() => { setPersona("academic"); setIsOpen(false); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                persona === "academic" ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary text-foreground"
              }`}
            >
              <GraduationCap className="h-4 w-4" /> Law Lecturer / Academic
            </button>
          </div>
        </div>
      )}
      
      <Button
        variant="outline"
        className="h-12 rounded-full shadow-lg border-border/60 bg-card/80 backdrop-blur-md hover:bg-card hover:border-primary/50 transition-all gap-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Icon className="h-4 w-4 text-primary" />
        <span className="font-medium">{currentLabel}</span>
        <Settings2 className="h-4 w-4 text-muted-foreground ml-1" />
      </Button>
    </div>
  );
}
