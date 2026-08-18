import { useState } from "react";
import { Scale, Building2, GraduationCap, BookOpen, Gavel, Users, ArrowRight, Loader2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePersona, Persona } from "@/lib/persona";
import { FrontDoorAssistant } from "@/components/front-door-assistant";

const PATHWAYS: { role: Exclude<Persona, null>; icon: LucideIcon; title: string; desc: string }[] = [
  {
    role: "practitioner",
    icon: Scale,
    title: "Legal Practitioner",
    desc: "I practise law in a law firm or legal practice. Focus on litigation, conveyancing, and firm management.",
  },
  {
    role: "inhouse",
    icon: Building2,
    title: "In-House Counsel",
    desc: "I manage legal work inside a company or organisation. Focus on contracts, compliance, and advisory.",
  },
  {
    role: "academic",
    icon: GraduationCap,
    title: "Law Lecturer",
    desc: "I teach, research or work academically in law. Focus on teaching, research, and supervision.",
  },
  {
    role: "student",
    icon: BookOpen,
    title: "Law Student",
    desc: "I'm studying law or preparing for the profession. Focus on learning, IRAC drills, and exam preparation.",
  },
  {
    role: "judicial",
    icon: Gavel,
    title: "Judicial Officer",
    desc: "I work in the judiciary or court system. Focus on legal research, judgment analysis, and case law.",
  },
  {
    role: "other",
    icon: Users,
    title: "Others",
    desc: "I work with the law in another capacity — paralegal, researcher, journalist, or just exploring.",
  },
];

export function PersonaFrontDoor() {
  const { persona, setPersona, skipFrontDoor } = usePersona();
  const [accessCode, setAccessCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [verifiedCode, setVerifiedCode] = useState<string | null>(null);
  const [selectingRole, setSelectingRole] = useState<Persona | null>(null);

  if (persona) return null;

  const handleSelect = async (role: Persona) => {
    // If they have a verified code, or if they typed one in without verifying, try to PUT.
    const codeToSubmit = verifiedCode || accessCode.trim();
    
    if (codeToSubmit) {
      setSelectingRole(role);
      setError(null);
      try {
        const res = await fetch("/api/personas", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: codeToSubmit, primaryRole: role }),
        });
        
        if (res.status === 404) {
          setError("Code not recognised. Continuing without code...");
          // Wait briefly so they see the message, but then let them in anyway
          setTimeout(() => {
            setPersona(role);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }, 1500);
          return;
        }
      } catch (err) {
        // ignore network error for the PUT and just let them in
      }
    }
    
    setPersona(role);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim()) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/personas/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: accessCode.trim() }),
      });
      
      if (res.status === 404) {
        setError("Code not recognised. Please try again.");
        return;
      }
      
      const data = await res.json();

      if (data.persona?.primaryRole) {
        setPersona(data.persona.primaryRole);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setVerifiedCode(accessCode.trim());
        setSuccessMsg("Code verified! Please select your role above.");
      }
    } catch (err) {
      setError("An error occurred verifying the code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 relative z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background opacity-50 pointer-events-none" />
      
      <div className="max-w-5xl w-full relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-1000 my-auto py-12">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <img
              src={`${import.meta.env.BASE_URL}lawyes-logo.png`}
              alt="LAWYes — Your Legal Work, Solved."
              className="h-40 md:h-52 w-auto"
            />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">
            Welcome to LAWYes
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold tracking-tight mb-6" style={{ textWrap: "balance" }}>
            How do you primarily <span className="text-gradient-gold">work in law?</span>
          </h1>
          <div className="max-w-3xl mx-auto rounded-2xl border border-primary/30 bg-primary/5 px-6 py-5 md:px-8 md:py-6">
            <p className="text-xl md:text-2xl font-medium text-foreground leading-relaxed" style={{ textWrap: "balance" }}>
              Pick the option that best describes your work — we'll arrange the site around the tools most relevant to you.
            </p>
            <p className="text-base md:text-lg text-muted-foreground mt-3">
              You can change this anytime, and it doesn't limit what you can access.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
          {PATHWAYS.map(({ role, icon: Icon, title, desc }, i) => (
            <button
              key={role}
              onClick={() => handleSelect(role)}
              disabled={!!selectingRole}
              className="group relative flex flex-col items-center text-center p-7 rounded-3xl border border-border/60 bg-card/60 backdrop-blur-sm hover:bg-card hover:border-primary/50 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-2 disabled:opacity-50 disabled:pointer-events-none"
              style={i > 0 ? { animationDelay: `${i * 75}ms` } : undefined}
            >
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-500">
                {selectingRole === role ? (
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                ) : (
                  <Icon className="h-8 w-8 text-primary" />
                )}
              </div>
              <h3 className="text-xl font-serif font-bold mb-3 group-hover:text-primary transition-colors">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              <div className="mt-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center text-primary text-sm font-semibold tracking-wide uppercase">
                Enter Portal <ArrowRight className="ml-2 h-4 w-4" />
              </div>
            </button>
          ))}
        </div>

        <div className="max-w-md mx-auto pt-10 border-t border-border/50">
          <form onSubmit={handleCodeSubmit} className="flex flex-col items-center text-center space-y-4">
            <p className="text-sm font-medium text-foreground">Already a subscriber? Link your access code first (optional)</p>
            <p className="text-xs text-muted-foreground -mt-2">
              Enter your code, then choose your role above — we'll remember it on all your devices.
            </p>
            <div className="flex w-full gap-2 relative">
              <Input
                placeholder="Enter your subscriber code"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                className="bg-card/50 border-border/50 focus-visible:ring-primary h-12 px-4 rounded-xl shadow-sm"
                disabled={!!verifiedCode}
              />
              <Button type="submit" disabled={loading || !!verifiedCode || !accessCode.trim()} className="h-12 px-6 rounded-xl font-medium">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Link"}
              </Button>
            </div>
            {error && <p className="text-sm text-destructive animate-in fade-in">{error}</p>}
            {successMsg && <p className="text-sm text-emerald-500 animate-in fade-in font-medium">{successMsg}</p>}
          </form>

          <div className="text-center mt-8">
            <button
              type="button"
              onClick={() => {
                skipFrontDoor();
                window.scrollTo({ top: 0 });
              }}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-border/70 bg-card/60 text-sm font-medium text-foreground hover:bg-card hover:border-primary/40 hover:text-primary transition-all duration-200 shadow-sm"
            >
              Skip — browse all portals
            </button>
          </div>
        </div>
      </div>

      <FrontDoorAssistant />
    </div>
  );
}
