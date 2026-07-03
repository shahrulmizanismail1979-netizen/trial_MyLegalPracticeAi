import { useQuery } from "@tanstack/react-query";
import { Show, useClerk } from "@clerk/react";
import { Redirect } from "wouter";
import { ShieldAlert, Loader2 } from "lucide-react";
import { basePath } from "@/lib/clerk";

interface AuthMe {
  userId: string;
  email: string | null;
  isStaff: boolean;
}

async function fetchAuthMe(): Promise<AuthMe> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) {
    throw new Error(`Auth check failed: ${res.status}`);
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
 * Gate admin pages: unauthenticated users are redirected to sign-in, and
 * authenticated-but-non-staff users see an access-denied screen. The server
 * independently enforces the same allowlist on every /api/admin/* request.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
      <Show when="signed-in">
        <StaffGate>{children}</StaffGate>
      </Show>
    </>
  );
}
