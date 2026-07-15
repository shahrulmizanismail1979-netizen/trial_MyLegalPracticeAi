import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MicrosoftLogo = () => (
  <svg className="mr-2 h-4 w-4" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
  </svg>
);

export default function LoginPage() {
  const { login, loginEmail, register, refresh } = useAuth();

  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  const [msTicket, setMsTicket] = useState("");
  const [msEmail, setMsEmail] = useState("");
  const [needsLink, setNeedsLink] = useState(false);
  const [linkCode, setLinkCode] = useState("");
  const [msError, setMsError] = useState("");
  const [msLoading, setMsLoading] = useState(false);

  const handleMicrosoftLogin = () => {
    window.location.href = "/auth/microsoft/login?app=sya";
  };

  const postSso = async (body: Record<string, string>) => {
    setMsError("");
    setMsLoading(true);
    try {
      const res = await fetch("/api/sya/auth/sso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.authenticated) {
        await refresh();
      } else if (res.status === 404 && data.needsLink) {
        setNeedsLink(true);
      } else {
        setMsError(data.message || data.error || "Sign in failed.");
      }
    } catch {
      setMsError("Failed to sign in with Microsoft.");
    } finally {
      setMsLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ticket = params.get("ms_ticket");
    const err = params.get("ms_error");
    const em = params.get("ms_email");
    const linked = params.get("ms_linked");
    if (em) setMsEmail(em);
    if (err) {
      setMsError(err);
    } else if (ticket) {
      setMsTicket(ticket);
      if (linked === "1") {
        postSso({ ticket });
      } else {
        setNeedsLink(true);
      }
    }
    if (ticket || err || em || linked) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkCode.trim()) {
      setMsError("Please enter your access code.");
      return;
    }
    await postSso({ ticket: msTicket, code: linkCode.trim().toUpperCase() });
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError("");
    setCodeLoading(true);
    const result = await login(code.trim().toUpperCase());
    if (!result.success) setCodeError(result.error || "Invalid access code");
    setCodeLoading(false);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    setEmailLoading(true);
    const result = await loginEmail(email.trim(), password);
    if (!result.success) setEmailError(result.error || "Invalid email or password");
    setEmailLoading(false);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    setEmailLoading(true);
    const result = await register(email.trim(), password, name.trim());
    if (!result.success) setEmailError(result.error || "Could not create account");
    setEmailLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/10 border-2 border-secondary flex items-center justify-center">
            <svg className="w-10 h-10 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground tracking-tight">
            MySyariahAI
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Platform Amalan Undang-Undang Syariah
          </p>
          <p className="text-xs text-muted-foreground">
            Shariah Legal Practice Platform
          </p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardContent className="pt-6">
            {needsLink ? (
              <form onSubmit={handleLinkSubmit} className="space-y-4">
                <p className="text-sm text-muted-foreground text-center leading-relaxed">
                  First time signing in with Microsoft{msEmail ? ` (${msEmail})` : ""} — enter your access code once to link it.
                </p>
                <Input
                  id="link-code"
                  type="text"
                  placeholder="Enter access code"
                  value={linkCode}
                  onChange={(e) => setLinkCode(e.target.value)}
                  className="text-center text-lg tracking-widest uppercase h-12"
                  disabled={msLoading}
                  aria-label="Access code"
                  data-testid="input-link-code"
                />
                {msError && (
                  <p className="text-sm text-destructive text-center" data-testid="text-ms-error">{msError}</p>
                )}
                <Button
                  type="submit"
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={msLoading || !linkCode.trim()}
                  data-testid="button-link-code"
                >
                  {msLoading ? "Linking..." : "Link & Continue"}
                </Button>
                <button
                  type="button"
                  onClick={() => { window.location.href = "/auth/microsoft/login?app=sya&prompt=select_account"; }}
                  className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
                  data-testid="button-switch-ms-account"
                >
                  Use another Microsoft account?
                </button>
              </form>
            ) : (
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="signin" data-testid="tab-signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup" data-testid="tab-signup">Sign Up</TabsTrigger>
                <TabsTrigger value="code" data-testid="tab-code">Access Code</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-5">
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11"
                    autoComplete="email"
                    disabled={emailLoading}
                    data-testid="input-login-email"
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11"
                    autoComplete="current-password"
                    disabled={emailLoading}
                    data-testid="input-login-password"
                  />
                  {emailError && (
                    <p className="text-sm text-destructive text-center" data-testid="text-auth-error">{emailError}</p>
                  )}
                  <Button
                    type="submit"
                    className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground"
                    disabled={emailLoading || !email.trim() || !password}
                    data-testid="button-login"
                  >
                    {emailLoading ? "Signing in..." : "Sign In / Masuk"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-5">
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <Input
                    type="text"
                    placeholder="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-11"
                    autoComplete="name"
                    disabled={emailLoading}
                    data-testid="input-register-name"
                  />
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11"
                    autoComplete="email"
                    disabled={emailLoading}
                    data-testid="input-register-email"
                  />
                  <Input
                    type="password"
                    placeholder="Password (min 8 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11"
                    autoComplete="new-password"
                    disabled={emailLoading}
                    data-testid="input-register-password"
                  />
                  {emailError && (
                    <p className="text-sm text-destructive text-center" data-testid="text-auth-error">{emailError}</p>
                  )}
                  <Button
                    type="submit"
                    className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground"
                    disabled={emailLoading || !email.trim() || password.length < 8 || !name.trim()}
                    data-testid="button-register"
                  >
                    {emailLoading ? "Creating account..." : "Create Account"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center leading-relaxed">
                    Free Starter plan. Upgrade anytime for AI tools, Voice Mode and more.
                  </p>
                </form>
              </TabsContent>

              <TabsContent value="code" className="mt-5">
                <form onSubmit={handleCodeSubmit} className="space-y-4">
                  <Input
                    id="access-code"
                    type="text"
                    placeholder="Enter access code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="text-center text-lg tracking-widest uppercase h-12"
                    disabled={codeLoading}
                    aria-label="Access code"
                    data-testid="input-access-code"
                  />
                  {codeError && (
                    <p className="text-sm text-destructive text-center" data-testid="text-code-error">{codeError}</p>
                  )}
                  <Button
                    type="submit"
                    className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground"
                    disabled={codeLoading || !code.trim()}
                    data-testid="button-verify-code"
                  >
                    {codeLoading ? "Verifying..." : "Masuk / Enter"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center leading-relaxed">
                    Access restricted to authorized Shariah legal practitioners only.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
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
                  className="w-full h-11 font-medium"
                  onClick={handleMicrosoftLogin}
                  disabled={msLoading}
                  data-testid="button-microsoft-login"
                >
                  <MicrosoftLogo />
                  Sign in with Microsoft
                </Button>
                {msError && (
                  <p className="text-sm text-destructive text-center mt-3" data-testid="text-ms-error">{msError}</p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-xs text-secondary/80 font-medium leading-relaxed">
            Dibangunkan oleh
          </p>
          <p className="text-sm text-foreground font-serif font-semibold mt-1 leading-snug">
            Prof Madya Dr Shahrul Mizan Ismail
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Fakulti Undang-Undang
          </p>
          <p className="text-xs text-muted-foreground font-semibold mt-0.5 tracking-wide">
            UNIVERSITI KEBANGSAAN MALAYSIA
          </p>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6 px-4 leading-relaxed">
          Semua rujukan kes dan perundangan mesti disahkan secara bebas terhadap sumber primer /
          All case and legislative references must be independently verified against primary sources
        </p>
      </div>
    </div>
  );
}
