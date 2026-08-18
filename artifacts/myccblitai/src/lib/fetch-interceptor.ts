/**
 * Patches window.fetch to emit a session-expired event on any 401 response
 * that does not come from an auth endpoint (to avoid redirect loops).
 * MyCCBLitAI uses bearer-token auth (localStorage), so any workspace 401
 * means the token has expired or been revoked.
 * Call setupFetchInterceptor() once at app startup.
 */
import { emitSessionExpired } from './session-expired-bus';

// URL fragments that identify auth endpoints — 401 from these should NOT trigger
// a session-expired redirect (they're expected rejections from login attempts).
const AUTH_PATH_FRAGMENTS = ['/auth/session', '/auth/verify', '/auth/login', '/auth/logout', '/auth/register', '/ccb/access'];

let installed = false;

export function setupFetchInterceptor(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const origFetch = window.fetch.bind(window);

  window.fetch = async function (...args: Parameters<typeof fetch>): Promise<Response> {
    const response = await origFetch(...args);

    if (response.status === 401) {
      const url =
        typeof args[0] === 'string'
          ? args[0]
          : args[0] instanceof Request
          ? args[0].url
          : String(args[0]);

      const isAuthEndpoint = AUTH_PATH_FRAGMENTS.some((fragment) => url.includes(fragment));
      if (!isAuthEndpoint) {
        emitSessionExpired();
      }
    }

    return response;
  };
}
