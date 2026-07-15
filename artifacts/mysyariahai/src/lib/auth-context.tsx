import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

interface User {
  id: number;
  name: string;
  role: string;
  tier: string;
  email?: string | null;
  accountType: "code" | "email";
}

interface AuthResult {
  success: boolean;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (accessCode: string) => Promise<AuthResult>;
  loginEmail: (email: string, password: string) => Promise<AuthResult>;
  register: (email: string, password: string, name: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = "/api/sya";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/session`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          setUser(data.user);
        }
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/session`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          setUser(data.user);
          return;
        }
      }
      setUser(null);
    } catch {
    }
  }, []);

  const login = async (accessCode: string): Promise<AuthResult> => {
    try {
      const res = await fetch(`${API_BASE}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accessCode }),
      });
      const data = await res.json();
      if (res.ok && data.authenticated) {
        setUser(data.user);
        return { success: true };
      }
      return { success: false, error: data.error || "Invalid access code" };
    } catch {
      return { success: false, error: "Network error" };
    }
  };

  const loginEmail = async (email: string, password: string): Promise<AuthResult> => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.authenticated) {
        setUser(data.user);
        return { success: true };
      }
      return { success: false, error: data.error || "Invalid email or password" };
    } catch {
      return { success: false, error: "Network error" };
    }
  };

  const register = async (email: string, password: string, name: string): Promise<AuthResult> => {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (res.ok && data.authenticated) {
        setUser(data.user);
        return { success: true };
      }
      return { success: false, error: data.error || "Could not create account" };
    } catch {
      return { success: false, error: "Network error" };
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
    } catch {
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        loginEmail,
        register,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
