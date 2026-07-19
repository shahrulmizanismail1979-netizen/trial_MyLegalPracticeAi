import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Real OAuth sign-in buttons. The backend handles the OAuth dance at
 * `/api/auth/oauth/{provider}/start` — clicking a button just navigates the
 * browser there. After the provider redirects back, the user lands on
 * /billing (if no active subscription) or the original `next` target.
 *
 * Buttons for providers that aren't configured (i.e. the corresponding env
 * vars aren't set) will still render but show a small "coming soon" hint
 * instead of redirecting. We detect configured providers via a tiny GET
 * to the backend on mount.
 */

const PROVIDERS = [
  {
    id: "google" as const,
    label: "Continue with Google",
    color: "from-white to-white/95 text-zinc-900",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.07 5.07 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/>
        <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.66-2.84Z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.46 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"/>
      </svg>
    ),
  },
];

const ERROR_MESSAGES: Record<string, string> = {
  bad_state: "Sign-in session expired. Please try again.",
  token_exchange: "Could not verify with the sign-in provider. Please try again.",
  no_access_token: "Provider did not return a sign-in token.",
  profile_unavailable:
    "Could not read your profile. Make sure you granted email permission.",
  network: "Network error talking to the sign-in provider. Please try again.",
  not_configured: "This sign-in method is not configured yet.",
  suspended: "Your account has been suspended. Contact an administrator.",
};

export function SocialLoginGate({ mode: _mode }: { mode: "sign in" | "sign up" }) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("oauth_error");
    if (err) {
      setErrorMessage(ERROR_MESSAGES[err] ?? `Sign-in failed (${err}).`);
      // Clean the URL so the error doesn't reappear on every render.
      params.delete("oauth_error");
      const newSearch = params.toString();
      window.history.replaceState(
        {},
        "",
        window.location.pathname + (newSearch ? `?${newSearch}` : ""),
      );
    }
  }, []);

  const start = (provider: "google" | "facebook") => {
    const next = encodeURIComponent(window.location.pathname);
    window.location.href = `/api/auth/oauth/${provider}/start?next=${next}`;
  };

  return (
    <div className="space-y-3" data-testid="social-login-gate">
      {errorMessage && (
        <div
          className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200"
          data-testid="oauth-error"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-2">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => start(p.id)}
            data-testid={`social-${p.id}`}
            className={cn(
              "relative group inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all",
              "bg-gradient-to-br shadow-sm hover:shadow-lg hover:-translate-y-0.5",
              p.color,
            )}
          >
            {p.icon}
            <span className="truncate">{p.label}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground">
        <div className="flex-1 h-px bg-white/10" />
        <span>or {_mode} with email</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>
    </div>
  );
}
