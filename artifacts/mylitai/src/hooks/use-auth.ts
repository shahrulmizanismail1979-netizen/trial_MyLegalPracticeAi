import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { clearAllDrafts } from './use-persistent-state';

const AUTH_KEY = 'mylitai_auth_verified';

export function useAuth() {
  const [, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const verify = useCallback(async () => {
    try {
      const res = await fetch('/api/lit/auth/verify', { credentials: 'include' });
      if (res.ok) {
        localStorage.setItem(AUTH_KEY, 'true');
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem(AUTH_KEY);
        setIsAuthenticated(false);
      }
    } catch {
      localStorage.removeItem(AUTH_KEY);
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    verify();
  }, [verify]);

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
        localStorage.setItem(AUTH_KEY, 'true');
        setIsAuthenticated(true);
        return { success: true };
      }
      return { success: false, error: data.error || 'Invalid or expired access code' };
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
    localStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
    setLocation('/');
  };

  return { isAuthenticated, login, logout, isLoading: isAuthenticated === null };
}
