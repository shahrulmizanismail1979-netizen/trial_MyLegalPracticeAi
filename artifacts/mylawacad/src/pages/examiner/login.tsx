import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { KeySquare, Loader2 } from "lucide-react";
import { useLogin } from "@/lib/api-client";
import {
  AuroraBackground,
  CinematicShell,
  GhostButton,
  VioletButton,
} from "@/components/cinematic";
import { useAuth } from "@/lib/auth-context";

export default function ExaminerLogin() {
  const [, navigate] = useLocation();
  const { user, loading, refresh } = useAuth();
  const login = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // If already signed in, send them to the right place.
  useEffect(() => {
    if (loading || !user) return;
    navigate(user.role === "admin" ? "/admin" : "/examiner/dashboard");
  }, [user, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    try {
      const res = await login.mutateAsync({
        data: { email: email.trim(), password },
      });
      await refresh();
      navigate(res.user.role === "admin" ? "/admin" : "/examiner/dashboard");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message.replace(/^HTTP \d+\s+\w+:\s*/, "")
          : "Login failed",
      );
    }
  };

  return (
    <CinematicShell>
      <section className="relative flex-1 flex items-center justify-center overflow-hidden py-16">
        <AuroraBackground />
        <motion.form
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          onSubmit={submit}
          className="relative z-10 glass-strong rounded-3xl px-10 py-12 w-full max-w-lg space-y-8"
        >
          <div className="flex items-center gap-3 text-fuchsia-300/80 text-[0.65rem] uppercase tracking-[0.4em]">
            <KeySquare className="h-4 w-4" />
            Examiner sign-in
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-4xl font-bold leading-tight">
              Welcome <span className="text-aurora">back</span>
            </h1>
            <p className="text-muted-foreground">
              Sign in with your teacher account to compose and conduct exams.
            </p>
          </div>

          <label className="block space-y-2">
            <span className="text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground">
              Email
            </span>
            <input
              type="email"
              autoComplete="email"
              data-testid="input-email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu"
              className="w-full bg-black/40 border border-white/15 rounded-xl px-5 py-4 text-base focus:outline-none focus:ring-2 focus:ring-fuchsia-500/60 focus:border-fuchsia-500/60"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground">
              Password
            </span>
            <input
              type="password"
              autoComplete="current-password"
              data-testid="input-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/40 border border-white/15 rounded-xl px-5 py-4 text-base focus:outline-none focus:ring-2 focus:ring-fuchsia-500/60 focus:border-fuchsia-500/60"
            />
          </label>

          {error ? (
            <div
              data-testid="text-login-error"
              className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2"
            >
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3 items-center">
            <VioletButton
              type="submit"
              disabled={login.isPending}
              data-testid="button-login"
            >
              {login.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
                </>
              ) : (
                <>Enter the studio</>
              )}
            </VioletButton>
            <Link href="/examiner/register" data-testid="link-register">
              <GhostButton type="button">Create account</GhostButton>
            </Link>
            <GhostButton type="button" onClick={() => navigate("/")}>
              Back
            </GhostButton>
          </div>

          <p className="text-xs text-muted-foreground/80">
            The first account ever created becomes the platform admin.
            Subsequent registrations create regular teacher accounts.
          </p>
        </motion.form>
      </section>
    </CinematicShell>
  );
}
