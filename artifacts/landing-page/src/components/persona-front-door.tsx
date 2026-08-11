import { useState } from "react";
import { Scale, Building2, GraduationCap, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePersona, Persona } from "@/lib/persona";

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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">
            Welcome to MyLegalPracticeAI
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold tracking-tight mb-6" style={{ textWrap: "balance" }}>
            How do you primarily <span className="text-gradient-gold">work in law?</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Pick the option that best describes your work — we'll arrange the site around the tools most relevant to you. You can change this anytime, and it doesn't limit what you can access.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <button
            onClick={() => handleSelect("practitioner")}
            disabled={!!selectingRole}
            className="group relative flex flex-col items-center text-center p-8 rounded-3xl border border-border/60 bg-card/60 backdrop-blur-sm hover:bg-card hover:border-primary/50 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-500">
              {selectingRole === "practitioner" ? (
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
              ) : (
                <Scale className="h-10 w-10 text-primary" />
              )}
            </div>
            <h3 className="text-2xl font-serif font-bold mb-4 group-hover:text-primary transition-colors">Legal Practitioner</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              I practise law in a law firm or legal practice. Focus on litigation, conveyancing, and firm management.
            </p>
            <div className="mt-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center text-primary text-sm font-semibold tracking-wide uppercase">
              Enter Portal <ArrowRight className="ml-2 h-4 w-4" />
            </div>
          </button>

          <button
            onClick={() => handleSelect("inhouse")}
            disabled={!!selectingRole}
            className="group relative flex flex-col items-center text-center p-8 rounded-3xl border border-border/60 bg-card/60 backdrop-blur-sm hover:bg-card hover:border-primary/50 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-2 disabled:opacity-50 disabled:pointer-events-none"
            style={{ animationDelay: "100ms" }}
          >
            <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-500">
              {selectingRole === "inhouse" ? (
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
              ) : (
                <Building2 className="h-10 w-10 text-primary" />
              )}
            </div>
            <h3 className="text-2xl font-serif font-bold mb-4 group-hover:text-primary transition-colors">In-House Counsel</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              I manage legal work inside a company or organisation. Focus on contracts, compliance, and advisory.
            </p>
            <div className="mt-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center text-primary text-sm font-semibold tracking-wide uppercase">
              Enter Portal <ArrowRight className="ml-2 h-4 w-4" />
            </div>
          </button>

          <button
            onClick={() => handleSelect("academic")}
            disabled={!!selectingRole}
            className="group relative flex flex-col items-center text-center p-8 rounded-3xl border border-border/60 bg-card/60 backdrop-blur-sm hover:bg-card hover:border-primary/50 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-2 disabled:opacity-50 disabled:pointer-events-none"
            style={{ animationDelay: "200ms" }}
          >
            <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-500">
              {selectingRole === "academic" ? (
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
              ) : (
                <GraduationCap className="h-10 w-10 text-primary" />
              )}
            </div>
            <h3 className="text-2xl font-serif font-bold mb-4 group-hover:text-primary transition-colors">Law Lecturer</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              I teach, research or work academically in law. Focus on teaching, research, and supervision.
            </p>
            <div className="mt-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center text-primary text-sm font-semibold tracking-wide uppercase">
              Enter Portal <ArrowRight className="ml-2 h-4 w-4" />
            </div>
          </button>
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
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
            >
              Skip for now — take me to the main page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
