import { useState, useEffect } from 'react';
import { clearAllDrafts } from './use-persistent-state';

const AUTH_KEY = 'mylitai_auth_verified';

// ── Shared auth store ────────────────────────────────────────────────────────
// useAuth() is called from several components at once (the router, every
// ProtectedRoute/PremiumRoute wrapper, the login page). Previously each hook
// instance kept its own `isAuthenticated` state and fired its own
// /auth/verify request. Because those copies resolved at slightly different
// times, the router could redirect off a route the guard hadn't yet
// authorised, leaving a blank screen until the user refreshed. Hoisting the
// state to a single module-level store — with one in-flight verify shared by
// all subscribers — gives every consumer the same value on the same render and
// removes the race.
let authState: boolean | null = null;
const authListeners = new Set<(v: boolean | null) => void>();
let verifyPromise: Promise<void> | null = null;
// Bumped whenever an authoritative auth transition happens (login / logout).
// A background /auth/verify captures the generation when it starts and only
// applies its result if the generation is still current — otherwise a slow
// initial verify that resolves *after* a successful login would clobber the
// authenticated state back to logged-out.
let authGeneration = 0;

function setAuthState(v: boolean | null) {
  authState = v;
  authListeners.forEach((fn) => fn(v));
}

// Record an authoritative transition (login success / logout). Invalidates any
// in-flight verify so its stale result is ignored, and applies the new state.
function commitAuth(v: boolean) {
  authGeneration += 1;
  verifyPromise = null;
  if (v) localStorage.setItem(AUTH_KEY, 'true');
  else localStorage.removeItem(AUTH_KEY);
  setAuthState(v);
}

function verifyAuth(force = false): Promise<void> {
  // De-dupe concurrent verifications: the first caller owns the request and
  // everyone else awaits the same promise.
  if (verifyPromise && !force) return verifyPromise;
  const generation = authGeneration;
  verifyPromise = (async () => {
    try {
      const res = await fetch('/api/lit/auth/verify', { credentials: 'include' });
      // A login/logout happened while this request was in flight — its result
      // is now stale, so drop it rather than overwrite the authoritative state.
      if (generation !== authGeneration) return;
      if (res.ok) {
        localStorage.setItem(AUTH_KEY, 'true');
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

  useEffect(() => {
    authListeners.add(setLocalAuth);
    // Sync to the latest shared value in case it changed before we subscribed.
    setLocalAuth(authState);
    // Kick off a single verification the first time any consumer mounts.
    if (authState === null) void verifyAuth();
    return () => {
      authListeners.delete(setLocalAuth);
    };
  }, []);

  const login = async (code: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/lit/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: code }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Fresh sign-in: wipe any drafts left by a previous user on this device.
        clearAllDrafts();
        commitAuth(true);
        return { success: true };
      }
      return { success: false, error: data.error || 'Invalid or expired access code' };
    } catch {
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const ssoLogin = async (
    ticket: string,
    code?: string,
  ): Promise<{ success: boolean; needsLink?: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/lit/auth/sso', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(code ? { ticket, code } : { ticket }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        // Fresh sign-in: wipe any drafts left by a previous user on this device.
        clearAllDrafts();
        commitAuth(true);
        return { success: true };
      }
      if (res.status === 404 && data.needsLink) {
        return { success: false, needsLink: true };
      }
      return { success: false, error: data.error || 'Microsoft sign-in failed. Please try again.' };
    } catch {
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/lit/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {}
    // Remove all in-progress drafts so the next user on this device can't see them.
    clearAllDrafts();
    // Authoritative transition: invalidates any in-flight verify and clears the
    // stored flag so a slow verify can't resurrect the session.
    commitAuth(false);
    // Hard reload to the portal root to guarantee a clean slate.
    window.location.assign(import.meta.env.BASE_URL);
  };

  return { isAuthenticated, login, ssoLogin, logout, isLoading: isAuthenticated === null };
}
