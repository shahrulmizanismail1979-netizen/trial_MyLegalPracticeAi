import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { trackEvent } from "@/lib/analytics";

const AUTH_KEY = "lawyes_auth_verified";
let authState: boolean | null = null;
const authListeners = new Set<(v: boolean | null) => void>();
let verifyPromise: Promise<void> | null = null;
let authGeneration = 0;

function setAuthState(v: boolean | null) {
  authState = v;
  authListeners.forEach((fn) => fn(v));
}

function commitAuth(v: boolean) {
  authGeneration += 1;
  verifyPromise = null;
  if (v) localStorage.setItem(AUTH_KEY, "true");
  else localStorage.removeItem(AUTH_KEY);
  setAuthState(v);
}

function verifyAuth(force = false): Promise<void> {
  if (verifyPromise && !force) return verifyPromise;
  const generation = authGeneration;
  verifyPromise = (async () => {
    try {
      const res = await fetch("/api/lit/auth/verify", { credentials: "include" });
      if (generation !== authGeneration) return;
      if (res.ok) {
        localStorage.setItem(AUTH_KEY, "true");
        setAuthState(true);
      } else {
        localStorage.removeItem(AUTH_KEY);
        setAuthState(false);
      }
    } catch {
      if (generation !== authGeneration) return;
      localStorage.removeItem(AUTH_KEY);
      setAuthState(false);
    } finally {
      if (generation === authGeneration) verifyPromise = null;
    }
  })();
  return verifyPromise;
}

export function useAuth() {
  const [isAuthenticated, setLocalAuth] = useState<boolean | null>(authState);
  const qc = useQueryClient();

  useEffect(() => {
    const handleUnauthorized = () => {
      qc.clear();
      commitAuth(false);
    };
    authListeners.add(setLocalAuth);
    window.addEventListener("lawyes:unauthorized", handleUnauthorized);
    setLocalAuth(authState);
    if (authState === null) void verifyAuth();
    return () => {
      authListeners.delete(setLocalAuth);
      window.removeEventListener("lawyes:unauthorized", handleUnauthorized);
    };
  }, [qc]);

  const login = async (code: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/lit/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: code }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        qc.clear();
        commitAuth(true);
        trackEvent("lawyes_login_succeeded", { auth_method: "access_code" });
        return { success: true };
      }
      trackEvent("lawyes_login_failed", {
        auth_method: "access_code",
        error_category: "invalid_or_expired",
      });
      return { success: false, error: data.error || "Invalid or expired access code" };
    } catch {
      trackEvent("lawyes_login_failed", {
        auth_method: "access_code",
        error_category: "network",
      });
      return { success: false, error: "Network error. Please try again." };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/lit/auth/logout", { method: "POST", credentials: "include" });
    } catch {}
    qc.clear();
    commitAuth(false);
    trackEvent("lawyes_logout");
  };

  return { isAuthenticated, login, logout, isLoading: isAuthenticated === null };
}
