import { createContext, useContext, useEffect, useState } from "react";
import { User, getManagerSession } from "@/lib/api-client";

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
};

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  setCurrentUser: () => {},
  isManager: false,
  authenticated: false,
  setAuthenticated: () => {},
  sessionChecked: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("mylawfirmai_user");
    return stored ? JSON.parse(stored) : null;
  });
  const [authenticated, setAuthenticated] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("mylawfirmai_user", JSON.stringify(currentUser));
    } else {
      localStorage.removeItem("mylawfirmai_user");
    }
  }, [currentUser]);

  // Reconcile local state with the server-verified session on load. Both staff
  // and manager status are authoritative on the server: adopt the real manager
  // user when a manager session exists, and drop a stale cached manager
  // identity otherwise so the UI can't show manager mode without a session.
  useEffect(() => {
    let cancelled = false;
    getManagerSession()
      .then((res) => {
        if (cancelled) return;
        setAuthenticated(res.staff);
        if (res.manager && res.user) {
          setCurrentUser(res.user);
        } else {
          setCurrentUser((prev) => (prev?.role === "manager" ? null : prev));
        }
      })
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
  }, []);

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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
