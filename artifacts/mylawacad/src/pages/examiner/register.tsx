import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Sparkles, Loader2 } from "lucide-react";
import { useRegister } from "@/lib/api-client";
import {
  AuroraBackground,
  CinematicShell,
  GhostButton,
  VioletButton,
} from "@/components/cinematic";
import { useAuth } from "@/lib/auth-context";

export default function ExaminerRegister() {
  const [, navigate] = useLocation();
  const { user, loading, refresh } = useAuth();
  const register = useRegister();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    navigate(user.role === "admin" ? "/admin" : "/examiner/dashboard");
  }, [user, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Display name is required.");
    if (!email.trim()) return setError("Email is required.");
    if (password.length < 8)
      return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");

    try {
      const res = await register.mutateAsync({
        data: { name: name.trim(), email: email.trim(), password },
      });
      await refresh();
      navigate(res.user.role === "admin" ? "/admin" : "/examiner/dashboard");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message.replace(/^HTTP \d+\s+\w+:\s*/, "")
          : "Registration failed",
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
          className="relative z-10 glass-strong rounded-3xl px-10 py-12 w-full max-w-lg space-y-7"
        >
          <div className="flex items-center gap-3 text-amber-300/80 text-[0.65rem] uppercase tracking-[0.4em]">
            <Sparkles className="h-4 w-4" />
            Create your account
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-4xl font-bold leading-tight">
              Become an <span className="text-aurora">examiner</span>
            </h1>
            <p className="text-muted-foreground">
              Your name marks the exams you author. Candidates will see it on
              their join screen.
            </p>
          </div>

          <Field label="Display name">
            <input
              data-testid="input-name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Prof. Aravind"
              className={inputClass}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              data-testid="input-email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu"
              className={inputClass}
            />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Password (≥ 8 chars)">
              <input
                type="password"
                data-testid="input-password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Confirm password">
              <input
                type="password"
                data-testid="input-confirm"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          {error ? (
            <div
              data-testid="text-register-error"
              className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2"
            >
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3 items-center">
            <VioletButton
              type="submit"
              disabled={register.isPending}
              data-testid="button-register"
            >
              {register.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating…
                </>
              ) : (
                <>Create account</>
              )}
            </VioletButton>
            <Link href="/examiner" data-testid="link-login">
              <GhostButton type="button">I already have one</GhostButton>
            </Link>
          </div>

          <p className="text-xs text-muted-foreground/80">
            Heads up: the very first account on this platform automatically
            becomes the admin. Tell your IT lead to register first.
          </p>
        </motion.form>
      </section>
    </CinematicShell>
  );
}

const inputClass =
  "w-full bg-black/40 border border-white/15 rounded-xl px-5 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-fuchsia-500/60 focus:border-fuchsia-500/60";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
