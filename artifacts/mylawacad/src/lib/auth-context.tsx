import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMe,
  useLogout as useLogoutMutation,
  getGetMeQueryKey,
  type AuthUser,
} from "@/lib/api-client";
import { AcadParalegal } from "@/components/paralegal";

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
      staleTime: 30_000,
    },
  });
  const logoutMutation = useLogoutMutation();

  const value = useMemo<AuthState>(() => {
    const user = (() => {
      if (me.isLoading) return null;
      if (me.error) return null;
      return me.data?.user ?? null;
    })();

    return {
      user,
      loading: me.isLoading,
      refresh: async () => {
        await me.refetch();
      },
      logout: async () => {
        try {
          await logoutMutation.mutateAsync();
        } catch {
          // even if the network call fails, we still clear local state
        }
        qc.setQueryData(getGetMeQueryKey(), undefined);
        await qc.invalidateQueries();
      },
    };
  }, [me, logoutMutation, qc]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

function loginPathForCurrentLocation(): string {
  if (typeof window !== "undefined") {
    const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    const path = window.location.pathname.startsWith(base)
      ? window.location.pathname.slice(base.length) || "/"
      : window.location.pathname;
    if (path.startsWith("/studio")) return "/studio/login";
  }
  return "/examiner";
}

/**
 * Redirects to the right login (/studio/login under /studio/*, else /examiner).
 * This is also the signed-in shell: render Amani here rather than in individual
 * dashboards so each protected route has exactly one widget.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate(loginPathForCurrentLocation());
  }, [user, loading, navigate, location]);

  if (loading) return <AuthLoading />;
  if (!user) return null;
  return (
    <>
      {children}
      <AcadParalegal />
    </>
  );
}

/** Admin variant of the signed-in shell. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate("/examiner");
    else if (user.role !== "admin") navigate("/examiner/dashboard");
  }, [user, loading, navigate]);

  if (loading) return <AuthLoading />;
  if (!user || user.role !== "admin") return null;
  return (
    <>
      {children}
      <AcadParalegal />
    </>
  );
}

function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
      Loading…
    </div>
  );
}
