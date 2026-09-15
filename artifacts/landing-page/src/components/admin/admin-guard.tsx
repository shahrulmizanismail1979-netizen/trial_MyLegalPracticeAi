import { useQuery } from "@tanstack/react-query";
import { useAuth, useClerk } from "@clerk/react";
import { useState } from "react";
import { Link } from "wouter";
import { ShieldAlert, Loader2, KeyRound } from "lucide-react";
import { basePath } from "@/lib/clerk";

interface AuthMe {
  userId: string | null;
  email: string | null;
  isStaff: boolean;
}

interface MasterSession {
  authenticated: boolean;
}

async function fetchAuthMe(): Promise<AuthMe> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) {
    throw new Error(`Auth check failed: ${res.status}`);
  }
  return res.json();
}

async function fetchMasterSession(): Promise<MasterSession> {
  const res = await fetch("/api/admin/master/session", {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`Master admin session check failed: ${res.status}`);
  }
  return res.json();
}

function LoadingScreen() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function AccessDenied() {
  const { signOut } = useClerk();

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="font-serif text-2xl font-bold text-foreground">
          Access restricted
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account is not authorized to access the command center. If you
          believe this is a mistake, contact an administrator to be added to the
          staff allowlist.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => signOut({ redirectUrl: basePath || "/" })}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Sign out
          </button>
          <a
            href={basePath || "/"}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
          >
            Back to site
          </a>
        </div>
      </div>
    </div>
  );
}

function MasterAdminLogin({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/master/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError(
          res.status === 429
            ? "Too many attempts. Please wait a few minutes and try again."
            : "Master admin access was not accepted.",
        );
        return;
      }
      setPassword("");
      onAuthenticated();
    } catch {
      setError("Unable to contact the command center. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <KeyRound className="h-6 w-6 text-primary" />
        </div>
        <h1 className="font-serif text-2xl font-bold text-foreground">
          Command Center
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with your staff account, or use the authorized master
          administrator credential.
        </p>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <label htmlFor="master-admin-password" className="text-sm font-medium">
              Master administrator credential
            </label>
            <input
              id="master-admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Checking access…" : "Enter command center"}
          </button>
        </form>

        <div className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
          <span>Staff member?</span>{" "}
          <Link
            href="/staff/sign-in"
            className="font-medium text-primary hover:underline"
          >
            Continue with staff sign-in
          </Link>
        </div>
      </div>
    </div>
  );
}

function StaffGate({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["auth-me"],
    queryFn: fetchAuthMe,
    retry: false,
    staleTime: 60_000,
  });

  if (isLoading) return <LoadingScreen />;
  if (isError || !data?.isStaff) return <AccessDenied />;
  return <>{children}</>;
}

/**
 * Gate admin pages with either the existing Clerk staff identity or the
 * landing-only signed master-admin session. The server independently enforces
 * the same boundary on every /api/admin/* request.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const masterSession = useQuery({
    queryKey: ["landing-admin-master-session"],
    queryFn: fetchMasterSession,
    enabled: isLoaded,
    retry: false,
  });

  if (!isLoaded) return <LoadingScreen />;
  if (masterSession.data?.authenticated) return <>{children}</>;
  if (isSignedIn) return <StaffGate>{children}</StaffGate>;
  if (masterSession.isLoading) return <LoadingScreen />;

  return (
    <MasterAdminLogin onAuthenticated={() => void masterSession.refetch()} />
  );
}
