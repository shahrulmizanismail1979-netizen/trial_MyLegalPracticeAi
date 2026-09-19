import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { User, getManagerSession, listUsers } from "@/lib/api-client";
import { fullFirmSignout } from "@/lib/firm-auth-api";
import { toast } from "sonner";

type AuthContextType = {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  isManager: boolean;
  // Whether the caller holds a verified staff (or manager) session. The app is
  // unusable until this is true — every API route requires it server-side.
  authenticated: boolean;
  setAuthenticated: (value: boolean) => void;
  // True once the initial server session check has completed, so the UI can
  // avoid flashing the login gate before the cookie is verified.
  sessionChecked: boolean;
  workspaceId: number | null;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  setCurrentUser: () => {},
  isManager: false,
  authenticated: false,
  setAuthenticated: () => {},
  sessionChecked: false,
  workspaceId: null,
  refreshSession: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [workspaceId, setWorkspaceId] = useState<number | null>(null);
  const workspaceRef = useRef<number | null>(null);
  const managerRef = useRef(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    if (currentUser) {
      if (workspaceId != null) {
        localStorage.setItem(`mylawfirmai_user:${workspaceId}`, JSON.stringify(currentUser));
      }
    }
  }, [currentUser, workspaceId]);

  const refreshSession = useCallback(async () => {
    const res = (await getManagerSession()) as Awaited<
      ReturnType<typeof getManagerSession>
    > & { workspaceId?: number };
    const nextWorkspace = res.workspaceId ?? null;
    if (nextWorkspace !== workspaceRef.current || managerRef.current !== Boolean(res.manager)) {
      queryClient.clear();
    }
    managerRef.current = Boolean(res.manager);
    workspaceRef.current = nextWorkspace;
    setWorkspaceId(nextWorkspace);
    setAuthenticated(res.staff);
    if (!res.staff || nextWorkspace == null) {
      setCurrentUser(null);
      return;
    }
    if (res.manager && res.user) {
      setCurrentUser(res.user);
      return;
    }
    const users = await listUsers();
    const raw = localStorage.getItem(`mylawfirmai_user:${nextWorkspace}`);
    let cached: User | null = null;
    try {
      cached = raw ? (JSON.parse(raw) as User) : null;
    } catch {
      localStorage.removeItem(`mylawfirmai_user:${nextWorkspace}`);
    }
    const valid = cached && users.find((user) => user.id === cached.id && user.role !== "manager");
    setCurrentUser(valid ?? users.find((user) => user.role !== "manager") ?? null);
  }, [queryClient]);

  const signOut = useCallback(async () => {
    try {
      await fullFirmSignout();
    } catch {
      toast.error("Sign-out could not be confirmed. Please try again.");
      return;
    }
    if (workspaceRef.current != null) {
      localStorage.removeItem(`mylawfirmai_user:${workspaceRef.current}`);
    }
    queryClient.clear();
    setCurrentUser(null);
    workspaceRef.current = null;
    managerRef.current = false;
    setWorkspaceId(null);
    setAuthenticated(false);
  }, [queryClient]);

  // Reconcile local state with the server-verified session on load. Both staff
  // and manager status are authoritative on the server: adopt the real manager
  // user when a manager session exists, and drop a stale cached manager
  // identity otherwise so the UI can't show manager mode without a session.
  useEffect(() => {
    let cancelled = false;
    refreshSession()
      .then(() => undefined)
      .catch(() => {
        // Ignore — the network may be unavailable; the user can enter the
        // passcode to establish a session.
      })
      .finally(() => {
        if (!cancelled) setSessionChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshSession]);

  const isManager = currentUser?.role === "manager";

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        isManager,
        authenticated,
        setAuthenticated,
        sessionChecked,
        workspaceId,
        refreshSession,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
