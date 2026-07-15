import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Scale, Lock, Loader2 } from "lucide-react";
import { useCorpVerifyPassword } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { setStoredTier } from "@/lib/tier";

const API_BASE = import.meta.env.VITE_API_URL || "";

const MicrosoftLogo = () => (
  <svg width="18" height="18" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
  </svg>
);

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const verifyPassword = useCorpVerifyPassword();

  const [msLoading, setMsLoading] = useState(false);
  const [needsLink, setNeedsLink] = useState(false);
  const [msTicket, setMsTicket] = useState("");
  const [msEmail, setMsEmail] = useState("");
  const [linkCode, setLinkCode] = useState("");

  const handleSsoSuccess = (res: { success?: boolean; token?: string; tier?: any }) => {
    if (res.success && res.token) {
      localStorage.setItem("auth_token", res.token);
      setStoredTier(res.tier);
      setLocation("/dashboard");
      return true;
    }
    return false;
  };

  const postSso = async (body: Record<string, string>) => {
    const res = await fetch(`${API_BASE}/api/corp/legal/sso`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let data: any = {};
    try {
      data = await res.json();
    } catch {
      /* ignore */
    }
    return { res, data };
  };

  useEffect(() => {
    if (localStorage.getItem("auth_token")) {
      setLocation("/dashboard");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const ticket = params.get("ms_ticket");
    const msError = params.get("ms_error");
    const email = params.get("ms_email") || "";

    if (msError || ticket) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (msError) {
      setError(msError);
      return;
    }

    if (ticket) {
      setMsTicket(ticket);
      setMsEmail(email);
      setMsLoading(true);
      setError("");
      (async () => {
        try {
          const { res, data } = await postSso({ ticket });
          if (res.ok) {
            handleSsoSuccess(data);
          } else if (res.status === 404 && data?.needsLink) {
            setNeedsLink(true);
          } else {
            setError(data?.message || data?.error || "Microsoft sign-in failed.");
          }
        } catch {
          setError("Microsoft sign-in failed. Please try again.");
        } finally {
          setMsLoading(false);
        }
      })();
    }
  }, [setLocation]);

  const handleMicrosoftLogin = () => {
    window.location.href = `${API_BASE}/auth/microsoft/login?app=corp`;
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMsLoading(true);
    try {
      const { res, data } = await postSso({ ticket: msTicket, code: linkCode });
      if (res.ok) {
        if (!handleSsoSuccess(data)) {
          setError("Invalid access code. Contact your administrator.");
        }
      } else {
        setError(data?.message || data?.error || "Failed to link account.");
      }
    } catch {
      setError("Failed to link account. Please try again.");
    } finally {
      setMsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    verifyPassword.mutate(
      { data: { password } },
      {
        onSuccess: (res) => {
          if (res.success && res.token) {
            localStorage.setItem("auth_token", res.token);
            setStoredTier(res.tier);
            setLocation("/dashboard");
          } else if (res.reason === "subscription_inactive") {
            setError("Your subscription is inactive. Please renew on the pricing page or contact support.");
          } else {
            setError("Invalid access code. Contact your administrator.");
          }
        },
        onError: () => {
          setError("Verification failed. Please try again.");
        }
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-purple-600/8 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-primary/6 blur-[100px]" />
      </div>

      <div className="w-full max-w-md bg-card border border-purple-500/15 p-8 rounded-xl shadow-2xl z-10 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500/50 via-primary to-purple-500/50" />
        
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary/15 to-purple-500/15 rounded-full flex items-center justify-center mb-4 border border-purple-500/20">
            <Scale className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Practitioner Login</h1>
          <p className="text-muted-foreground text-sm mt-2">Enter your unique access code to continue.</p>
        </div>

        {needsLink ? (
          <form onSubmit={handleLinkSubmit} className="space-y-6">
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4 text-sm text-muted-foreground">
              First time signing in with Microsoft{msEmail ? ` as ${msEmail}` : ""} — enter your access code once to link it.
            </div>
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Access Code"
                  className="pl-10 bg-background border-purple-500/15 h-12 focus:border-primary"
                  value={linkCode}
                  onChange={(e) => setLinkCode(e.target.value)}
                  autoFocus
                />
              </div>
              {error && <p className="text-destructive text-sm font-medium">{error}</p>}
            </div>

            <Button
              type="submit"
              className="w-full h-12 font-semibold text-base"
              disabled={msLoading}
            >
              {msLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Link & Continue"}
            </Button>
          </form>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input 
                    type="password" 
                    placeholder="Access Code" 
                    className="pl-10 bg-background border-purple-500/15 h-12 focus:border-primary"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                  />
                </div>
                {error && <p className="text-destructive text-sm font-medium">{error}</p>}
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 font-semibold text-base"
                disabled={verifyPassword.isPending}
              >
                {verifyPassword.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Authenticate"}
              </Button>
            </form>

            <div className="flex items-center gap-3 my-6">
              <div className="h-px flex-1 bg-purple-500/15" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
              <div className="h-px flex-1 bg-purple-500/15" />
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-12 font-semibold text-base gap-2 border-purple-500/20"
              onClick={handleMicrosoftLogin}
              disabled={msLoading}
            >
              {msLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <MicrosoftLogo />
                  Sign in with Microsoft
                </>
              )}
            </Button>
          </>
        )}
        
        <div className="mt-8 pt-6 border-t border-purple-500/10 text-center space-y-2">
          <p className="text-xs text-muted-foreground">Single-session access. Previous sessions will be terminated.</p>
          <p className="text-xs text-muted-foreground">
            Need access?{" "}
            <Link href="/pricing" className="text-primary hover:underline font-medium">
              View plans &amp; subscribe
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
