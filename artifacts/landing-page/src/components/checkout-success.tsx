import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, Check, ExternalLink, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import { canonicalPortalRedirect } from "@/lib/portal-redirect";

interface SessionInfo {
  accessCode: string | null;
  apps: string[];
  tier: string | null;
  trial: boolean;
}

export function CheckoutSuccess() {
  const [open, setOpen] = useState(false);
  const [redirect, setRedirect] = useState<string | null>(null);
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const completionTracked = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;

    const redirectParam = canonicalPortalRedirect(params.get("redirect"));
    if (redirectParam) {
      setRedirect(redirectParam);
    }

    setOpen(true);

    const sessionId = params.get("session_id");
    if (!sessionId) {
      setLoading(false);
      setError("Missing checkout session reference.");
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const load = async () => {
      attempts += 1;
      try {
        const res = await fetch(
          `/api/stripe/session-info?session_id=${encodeURIComponent(sessionId)}`,
        );
        if (res.ok) {
          const data = (await res.json()) as SessionInfo;
          if (!cancelled) {
            setInfo(data);
            setLoading(false);
            if (!completionTracked.current) {
              completionTracked.current = true;
              trackEvent("checkout_completed", {
                tier: data.tier && [
                  "single", "bundle", "standard",
                  "firm_starter", "firm_growth", "firm_scale",
                  "corporate_starter", "corporate_growth", "corporate_scale",
                  "education_starter", "education_growth", "education_scale",
                ].includes(data.tier) ? data.tier : "unknown",
                is_trial: data.trial,
                app_count: data.apps.length,
                access_ready: Boolean(data.accessCode),
              });
            }
          }
          return;
        }
        // Payment confirmation can lag a moment — retry a few times.
        if (attempts < 5) {
          setTimeout(load, 2500);
          return;
        }
        if (!cancelled) {
          setLoading(false);
          setError(
            "Your payment was received, but we could not load your access code automatically. It has been emailed to you — or contact support and we will send it right away.",
          );
        }
      } catch {
        if (attempts < 5) {
          setTimeout(load, 2500);
          return;
        }
        if (!cancelled) {
          setLoading(false);
          setError(
            "Your payment was received, but we could not load your access code automatically. It has been emailed to you — or contact support and we will send it right away.",
          );
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!open) return null;

  const copyCode = () => {
    if (!info?.accessCode) return;
    navigator.clipboard.writeText(info.accessCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const close = () => {
    setOpen(false);
    // Clean the query string so a refresh doesn't reopen the dialog.
    window.history.replaceState({}, "", window.location.pathname);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-xl border border-primary/30 bg-card p-6 shadow-2xl">
        <button
          onClick={close}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <CheckCircle2 className="h-8 w-8 text-emerald-400 shrink-0" />
          <div>
            <h3 className="font-serif text-xl font-bold">Payment successful!</h3>
            {info?.trial && (
              <p className="text-xs text-muted-foreground">
                Your 7-day free trial has started.
              </p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparing your access code…
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground py-2">{error}</p>
        ) : info ? (
          <>
            <p className="text-sm text-muted-foreground mb-2">
              Here is your access code. It has also been emailed to you — keep it safe:
            </p>
            <div className="flex items-center gap-2 rounded-lg border-2 border-primary/50 bg-primary/5 px-4 py-3 mb-4">
              <span className="flex-1 font-mono text-lg font-bold tracking-wider text-center">
                {info.accessCode}
              </span>
              <Button size="icon" variant="ghost" onClick={copyCode} aria-label="Copy code">
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            {info.apps.length > 0 ? (
              <p className="text-xs text-muted-foreground mb-4">
                Valid for: <span className="text-foreground">{info.apps.join(", ")}</span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mb-4">
                Reply to your confirmation email to tell us which portal you would like to use.
              </p>
            )}
            <p className="text-xs text-muted-foreground mb-4">
              Use this code to log in to your portal. If the portal does not accept it yet, your
              account is still being activated — it will work within a few hours.
            </p>
          </>
        ) : null}

        <div className="flex gap-2">
          {redirect && (
            <Button
              className="flex-1"
              onClick={() => {
                window.location.href = redirect;
              }}
            >
              Open your portal <ExternalLink className="h-4 w-4 ml-1" />
            </Button>
          )}
          <Button variant="outline" className="flex-1" onClick={close}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
