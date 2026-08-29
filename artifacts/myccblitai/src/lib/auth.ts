import { clearStoredPersona, configurePersonaAuthHeaders } from "@workspace/persona-client";

export const TOKEN_KEY = "myccblitai_access_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  // Clear the shared persona cache so the next subscriber on a shared browser
  // never sees or edits the previous subscriber's professional mode.
  clearStoredPersona();
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Persona updates now require this portal's bearer session. Register a header
// provider once (module import runs app-wide) so the shared persona client can
// authenticate PUT /api/personas with our stored JWT.
configurePersonaAuthHeaders(() => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : null;
});