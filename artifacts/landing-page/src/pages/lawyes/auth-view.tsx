import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "./use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Shield, KeyRound, Lock, Scale } from "lucide-react";

export function AuthView({ returnTo }: { returnTo?: string } = {}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  const currentLocation =
    typeof window !== "undefined"
      ? `${location}${window.location.search}${window.location.hash}`
      : location;
  const destination =
    returnTo ||
    (currentLocation === "/lawyes" || currentLocation.startsWith("/lawyes/")
      ? currentLocation
      : "/lawyes");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    
    setLoading(true);
    const { success, error } = await login(code.trim());
    setLoading(false);
    
    if (!success) {
      toast({
        variant: "destructive",
        title: "Authentication Failed",
        description: error || "Invalid access code. Please verify your credentials and try again."
      });
      return;
    }
    setLocation(destination);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 flex-col p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        
        <div className="font-serif text-3xl font-medium tracking-tight text-white mb-auto relative z-10">
          LAW<span className="italic text-slate-400">Yes</span>
        </div>
        
        <div className="relative z-10 max-w-lg">
          <h1 className="text-4xl font-serif font-medium text-white mb-6 leading-tight">
            Secure Practitioner Environment
          </h1>
          <p className="text-slate-300 text-lg leading-relaxed mb-8">
            Access your secure matter workspaces, unified research, and drafting tools. All sessions are encrypted and subject to strict data locality controls.
          </p>
          
          <div className="grid grid-cols-2 gap-6 mt-12">
            <div className="flex gap-3 items-start">
              <Shield className="w-6 h-6 text-slate-400 shrink-0" />
              <div>
                <h3 className="text-white font-medium text-sm mb-1">Encrypted Sessions</h3>
                <p className="text-slate-400 text-xs leading-relaxed">End-to-end encryption for all matter communications.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <Scale className="w-6 h-6 text-slate-400 shrink-0" />
              <div>
                <h3 className="text-white font-medium text-sm mb-1">Ethical Walls</h3>
                <p className="text-slate-400 text-xs leading-relaxed">Strict compartmentalization between active matters.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden font-serif text-3xl font-medium tracking-tight text-slate-900 dark:text-white mb-12 text-center">
            LAW<span className="italic text-slate-500">Yes</span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 shadow-sm">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
              <Lock className="w-6 h-6 text-slate-700 dark:text-slate-300" />
            </div>
            
            <h2 className="text-2xl font-serif font-medium text-slate-900 dark:text-white mb-2">
              Practitioner Sign In
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
              Enter your access code to authenticate your session.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="code" className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  Access Code
                </label>
                <Input
                  id="code"
                  type="password"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter your assigned code"
                  className="font-mono"
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={loading || !code.trim()}>
                {loading ? "Verifying..." : "Authenticate Session"}
              </Button>
            </form>
          </div>
          
          <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
            Staff member?{" "}
            <a
              href="/staff/sign-in"
              className="font-medium text-primary hover:underline"
            >
              Use staff sign in
            </a>
          </p>

          <p className="text-center text-xs text-slate-400 mt-8">
            Unauthorized access to this system is strictly prohibited.
          </p>
        </div>
      </div>
    </div>
  );
}
