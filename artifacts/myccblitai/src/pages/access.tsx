import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { setToken } from "@/lib/auth";
import { lookupPersona } from "@workspace/persona-client";
import { Shield, Lock } from "lucide-react";
import { motion } from "framer-motion";

function MicrosoftLogo() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export default function AccessPage() {
  const [, setLocation] = useLocation();
  const [code, setCode] = useState("");
  const { toast } = useToast();
  const [msError, setMsError] = useState<string | null>(null);
  const [msTicket, setMsTicket] = useState<string | null>(null);
  const [msEmail, setMsEmail] = useState<string | null>(null);
  const [needsLink, setNeedsLink] = useState(false);
  const [linkCode, setLinkCode] = useState("");
  const [msProcessing, setMsProcessing] = useState(false);

  const handleLoginSuccess = (data: { success: boolean; token: string }) => {
    setToken(data.token);
    toast({
      title: "Access Granted",
      description: "Welcome to MyCCBLitAI Workspace.",
    });
    setLocation("/workspace");
  };

  const postSso = async (payload: { ticket: string; code?: string }) => {
    const res = await fetch("/api/ccb/auth/sso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let data: any = {};
    try {
      data = await res.json();
    } catch {
      // ignore
    }
    return { res, data };
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("ms_error");
    const ticket = params.get("ms_ticket");
    const email = params.get("ms_email");

    if (!error && !ticket) return;

    const clean = () => {
      history.replaceState({}, "", window.location.pathname);
    };

    if (error) {
      setMsError(error);
      clean();
      return;
    }

    if (ticket) {
      setMsTicket(ticket);
      setMsEmail(email);
      setMsProcessing(true);
      clean();
      (async () => {
        try {
          const { res, data } = await postSso({ ticket });
          if (res.ok && data.success && data.token) {
            handleLoginSuccess(data);
          } else if (res.status === 404 && data.needsLink) {
            setNeedsLink(true);
          } else {
            setMsError(data.error ?? "Microsoft sign-in failed.");
          }
        } catch {
          setMsError("Microsoft sign-in failed.");
        } finally {
          setMsProcessing(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMicrosoftLogin = () => {
    window.location.href = "/auth/microsoft/login?app=ccb";
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msTicket || !linkCode.trim()) return;
    setMsProcessing(true);
    setMsError(null);
    try {
      const { res, data } = await postSso({ ticket: msTicket, code: linkCode });
      if (res.ok && data.success && data.token) {
        // Fire-and-forget persona lookup with the linked access code.
        void lookupPersona(linkCode);
        handleLoginSuccess(data);
      } else {
        setMsError(data.error ?? "Invalid access code. Please try again.");
      }
    } catch {
      setMsError("Microsoft sign-in failed.");
    } finally {
      setMsProcessing(false);
    }
  };
  
  const verifyMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch("/api/ccb/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invalid access code");
      return data as { success: boolean; token: string };
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast({
        title: "Code required",
        description: "Please enter your access code.",
        variant: "destructive"
      });
      return;
    }

    verifyMutation.mutate(code, {
      onSuccess: (data) => {
        if (data.success && data.token) {
          setToken(data.token);
          // Fire-and-forget persona lookup; must never block or fail login.
          void lookupPersona(code);
          toast({
            title: "Access Granted",
            description: "Welcome to MyCCBLitAI Workspace.",
          });
          setLocation("/workspace");
        } else {
          toast({
            title: "Access Denied",
            description: "Invalid access code. Please try again.",
            variant: "destructive"
          });
        }
      },
      onError: (error) => {
        toast({
          title: "Access Denied",
          description: "Invalid access code or server error.",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 bg-[url('/bg-pattern.svg')] bg-repeat">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-0"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="z-10 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-primary/10 border border-primary/20 mb-6">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-serif font-bold tracking-tight mb-2">MyCCBLit<span className="text-primary">AI</span></h1>
          <p className="text-muted-foreground">Authorized practitioners only</p>
        </div>

        <Card className="border-border/50 shadow-2xl shadow-primary/5 bg-card/50 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-xl font-serif text-center">Secure Access</CardTitle>
            <CardDescription className="text-center">
              Enter your practitioner access code to proceed
            </CardDescription>
          </CardHeader>
          <CardContent>
            {msError && (
              <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="text-ms-error">
                {msError}
              </div>
            )}

            {needsLink ? (
              <form onSubmit={handleLinkSubmit} className="space-y-4" data-testid="form-ms-link">
                <div className="rounded-md border border-border/50 bg-background/40 px-3 py-2 text-sm text-muted-foreground">
                  First time signing in with Microsoft{msEmail ? ` (${msEmail})` : ""} — enter your access code once to link it.
                </div>
                <div className="space-y-2">
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="Enter access code"
                      className="pl-10 h-10 bg-background/50 border-border/50 focus:border-primary/50"
                      value={linkCode}
                      onChange={(e) => setLinkCode(e.target.value)}
                      data-testid="input-link-code"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-10 font-medium"
                  disabled={msProcessing}
                  data-testid="button-submit-link"
                >
                  {msProcessing ? "Linking..." : "Link & Continue"}
                </Button>
                <button
                  type="button"
                  onClick={() => { window.location.href = "/auth/microsoft/login?app=ccb&prompt=select_account"; }}
                  className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
                  data-testid="button-switch-ms-account"
                >
                  Use another Microsoft account?
                </button>
              </form>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        type="password" 
                        placeholder="Enter access code" 
                        className="pl-10 h-10 bg-background/50 border-border/50 focus:border-primary/50"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        data-testid="input-access-code"
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-10 font-medium" 
                    disabled={verifyMutation.isPending}
                    data-testid="button-submit-access"
                  >
                    {verifyMutation.isPending ? "Verifying..." : "Masuk / Enter"}
                  </Button>
                </form>

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
                  className="w-full h-10 font-medium gap-2 bg-background/50 border-border/50"
                  onClick={handleMicrosoftLogin}
                  disabled={msProcessing}
                  data-testid="button-microsoft-login"
                >
                  <MicrosoftLogo />
                  {msProcessing ? "Signing in..." : "Sign in with Microsoft"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
        
        <p className="text-center text-xs text-muted-foreground mt-8">
          &copy; {new Date().getFullYear()} Faculty of Law, Universiti Kebangsaan Malaysia. All rights reserved.
        </p>
      </motion.div>
    </div>
  );
}
