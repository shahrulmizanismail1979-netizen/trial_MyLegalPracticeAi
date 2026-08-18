import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAccidentVerifyCode, getAccidentCheckSessionQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Scale, Lock, ArrowLeft } from "lucide-react";

const MicrosoftLogo = () => (
  <svg className="mr-2 h-4 w-4" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
  </svg>
);

export default function Login() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const verifyCode = useAccidentVerifyCode();
  const [msTicket, setMsTicket] = useState("");
  const [msEmail, setMsEmail] = useState("");
  const [needsLink, setNeedsLink] = useState(false);
  const [linkCode, setLinkCode] = useState("");
  const [msLoading, setMsLoading] = useState(false);

  const handleMicrosoftLogin = () => {
    window.location.href = "/auth/microsoft/login?app=accident";
  };

  const handleLoginSuccess = async () => {
    queryClient.setQueryData(getAccidentCheckSessionQueryKey(), {
      authenticated: true,
      codeLabel: null,
    });
    await queryClient.invalidateQueries({ queryKey: getAccidentCheckSessionQueryKey() });
    await queryClient.refetchQueries({ queryKey: getAccidentCheckSessionQueryKey() });
    setLocation("/workspace");
  };

  const postSso = async (body: Record<string, string>) => {
    setError("");
    setMsLoading(true);
    try {
      const res = await fetch("/api/accident/auth/sso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.valid) {
          await handleLoginSuccess();
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
    if (!linkCode.trim()) {
      setError("Please enter an access code");
      return;
    }
    postSso({ ticket: msTicket, code: linkCode.trim().toUpperCase() });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!code.trim()) {
      setError("Please enter an access code");
      return;
    }
    verifyCode.mutate(
      { data: { code: code.trim().toUpperCase() } },
      {
        onSuccess: async (result) => {
          if (result.valid) {
            queryClient.setQueryData(getAccidentCheckSessionQueryKey(), {
              authenticated: true,
              codeLabel: null,
            });
            await queryClient.invalidateQueries({ queryKey: getAccidentCheckSessionQueryKey() });
            await queryClient.refetchQueries({ queryKey: getAccidentCheckSessionQueryKey() });
            setLocation("/workspace");
          } else {
            setError(result.message || "Invalid access code");
          }
        },
        onError: (err: any) => {
          setError(err?.data?.error || "Invalid access code. Please try again.");
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-md px-6">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
            <Scale className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-serif font-bold mb-2">
            MyAccident<span className="text-primary">Ai</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Accident, Personal Injury & Running Down Practice Platform
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Access Code</h2>
          </div>

          {needsLink ? (
            <form onSubmit={handleLinkSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                First time signing in with Microsoft{msEmail ? ` (${msEmail})` : ""} — enter your access code once to link it.
              </p>
              <div>
                <Input
                  type="text"
                  placeholder="Enter your access code"
                  value={linkCode}
                  onChange={(e) => setLinkCode(e.target.value)}
                  className="h-12 text-center text-lg tracking-wider uppercase bg-background border-border"
                  data-testid="input-link-code"
                  autoFocus
                />
              </div>
              {error && (
                <p className="text-sm text-destructive text-center" data-testid="text-error">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="w-full h-12 text-base bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={msLoading}
                data-testid="button-link-code"
              >
                {msLoading ? "Linking..." : "Link & Continue"}
              </Button>
              <button
                type="button"
                onClick={() => { window.location.href = "/auth/microsoft/login?app=accident&prompt=select_account"; }}
                className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
                data-testid="button-switch-ms-account"
              >
                Use another Microsoft account?
              </button>
            </form>
          ) : (
          <>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="Enter your access code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="h-12 text-center text-lg tracking-wider uppercase bg-background border-border"
                data-testid="input-access-code"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm text-destructive text-center" data-testid="text-error">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={verifyCode.isPending}
              data-testid="button-submit-code"
            >
              {verifyCode.isPending ? "Verifying..." : "Access Platform"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full h-12 text-base"
            onClick={handleMicrosoftLogin}
            disabled={msLoading}
            data-testid="button-microsoft-login"
          >
            <MicrosoftLogo />
            Sign in with Microsoft
          </Button>
          </>
          )}

          <p className="text-xs text-muted-foreground text-center mt-6">
            Access restricted to authorized legal practitioners only.
          </p>
        </div>

        <div className="text-center mt-8 space-y-3">
          <Link href="/" className="inline-flex items-center gap-1 text-xs text-primary hover:underline" data-testid="link-back-home">
            <ArrowLeft className="h-3 w-3" /> Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
