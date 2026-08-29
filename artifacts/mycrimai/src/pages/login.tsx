import { useCrimVerifyAccessCode } from "@workspace/api-client-react";
import { lookupPersona } from "@workspace/persona-client";
import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Scale, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const MicrosoftLogo = () => (
  <svg className="mr-2 h-4 w-4" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
  </svg>
);

export function LoginPage() {
  const [, setLocation] = useLocation();
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [msTicket, setMsTicket] = useState("");
  const [msEmail, setMsEmail] = useState("");
  const [needsLink, setNeedsLink] = useState(false);
  const [linkCode, setLinkCode] = useState("");
  const [msLoading, setMsLoading] = useState(false);

  const verifyCode = useCrimVerifyAccessCode();

  const handleMicrosoftLogin = () => {
    window.location.href = "/auth/microsoft/login?app=crim";
  };

  const postSso = async (body: Record<string, string>) => {
    setError("");
    setMsLoading(true);
    try {
      const res = await fetch("/api/crim/auth/sso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.authenticated) {
          // Fire-and-forget persona lookup when an access code was supplied
          // (SSO-only logins without a code are skipped).
          if (body.code) void lookupPersona(body.code);
          setLocation("/workspace");
        } else {
          setError(data.message || "Sign in failed.");
        }
      } else if (res.status === 404 && data.needsLink) {
        setNeedsLink(true);
      } else {
        setError(data.message || data.error || "Sign in failed.");
      }
    } catch {
      setError("Failed to sign in with Microsoft.");
    } finally {
      setMsLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ticket = params.get("ms_ticket");
    const msError = params.get("ms_error");
    const email = params.get("ms_email");
    if (email) setMsEmail(email);
    if (msError) {
      setError(msError);
    } else if (ticket) {
      setMsTicket(ticket);
      postSso({ ticket });
    }
    if (ticket || msError || email || params.get("ms_linked")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkCode) {
      setError("Please enter your access code.");
      return;
    }
    postSso({ ticket: msTicket, code: linkCode });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!accessCode) {
      setError("Please enter your access code.");
      return;
    }

    verifyCode.mutate(
      { data: { accessCode } },
      {
        onSuccess: (data) => {
          if (data.authenticated) {
            // Fire-and-forget: never block or fail login on persona lookup.
            void lookupPersona(accessCode);
            setLocation("/workspace");
          } else {
            setError(data.message || "Invalid access code.");
          }
        },
        onError: (err: any) => {
          setError(err?.response?.data?.message || err?.message || "Failed to verify access code.");
        }
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background z-0 pointer-events-none"></div>
      
      <div className="z-10 w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="bg-primary/10 p-3 rounded-full border border-primary/20">
              <Scale className="h-8 w-8 text-primary" />
            </div>
          </Link>
        </div>

        <Card className="border-primary/20 bg-card/50 backdrop-blur-sm shadow-2xl shadow-primary/5">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="font-serif text-3xl font-bold tracking-tight">Private Access</CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
              Enter your practitioner access code to enter the workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {needsLink ? (
              <form onSubmit={handleLinkSubmit} className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  First time signing in with Microsoft{msEmail ? ` (${msEmail})` : ""} — enter your access code once to link it.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="linkCode" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Access Code</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="linkCode"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10 h-10 bg-background/50 border-input font-mono"
                      value={linkCode}
                      onChange={(e) => setLinkCode(e.target.value)}
                    />
                  </div>
                  {error && <p className="text-sm text-destructive font-medium">{error}</p>}
                </div>
                <Button
                  type="submit"
                  className="w-full h-10 font-medium tracking-wide"
                  disabled={msLoading}
                >
                  {msLoading ? "Linking..." : "Link & Continue"}
                  {!msLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
                <button
                  type="button"
                  onClick={() => { window.location.href = "/auth/microsoft/login?app=crim&prompt=select_account"; }}
                  className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
                >
                  Use another Microsoft account?
                </button>
              </form>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="accessCode" className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Access Code</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="accessCode"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10 h-10 bg-background/50 border-input font-mono"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-destructive font-medium">{error}</p>}
              </div>
              <Button 
                type="submit" 
                className="w-full h-10 font-medium tracking-wide" 
                disabled={verifyCode.isPending}
              >
                {verifyCode.isPending ? "Verifying..." : "Enter Workspace"}
                {!verifyCode.isPending && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </form>
            )}
            {!needsLink && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 font-medium tracking-wide"
                  onClick={handleMicrosoftLogin}
                  disabled={msLoading}
                >
                  <MicrosoftLogo />
                  Sign in with Microsoft
                </Button>
              </>
            )}
          </CardContent>
          <CardFooter className="justify-center border-t border-border/50 pt-6">
            <Link href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
              &larr; Back to MyCrimAi home
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
