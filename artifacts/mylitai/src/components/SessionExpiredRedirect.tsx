import { useEffect, useRef, useState } from 'react';
import { onSessionExpired } from '@/lib/session-expired-bus';

/**
 * Mounted globally in App. Listens for 401-triggered session-expiry events
 * and redirects the user to the sign-in page with a brief notice.
 */
export function SessionExpiredRedirect() {
  const redirecting = useRef(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    return onSessionExpired(() => {
      if (redirecting.current) return;
      redirecting.current = true;
      setVisible(true);

      setTimeout(() => {
        const base = import.meta.env.BASE_URL.replace(/\/$/, '');
        window.location.href = `${base}/login?expired=1`;
      }, 2000);
    });
  }, []);

  if (!visible) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="bg-background border border-border rounded-xl shadow-2xl px-8 py-6 max-w-sm w-full text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
          <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-foreground mb-1">Session Expired</h2>
        <p className="text-sm text-muted-foreground">Your session has expired. Redirecting you to sign in…</p>
      </div>
    </div>
  );
}
