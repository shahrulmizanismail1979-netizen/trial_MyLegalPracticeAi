/**
 * AI rate-limit visibility.
 *
 * The api-server rate-limits AI endpoints per lawyer (60 req/min by default)
 * and returns IETF draft-8 rate-limit headers on every AI response:
 *
 *   RateLimit: "<name>"; r=<remaining>; t=<seconds-until-reset>
 *   RateLimit-Policy: "<name>"; q=<limit>; w=<window-seconds>; ...
 *
 * This module patches window.fetch once to observe those headers on
 * same-origin /api responses and exposes a <RateLimitBanner /> that shows a
 * subtle warning when the remaining quota drops below a threshold, and a
 * blocked notice on 429 — so lawyers are never surprised by a block.
 */
import { useEffect, useState } from "react";

export interface RateLimitStatus {
  remaining: number;
  limit: number | null;
  /** epoch ms when the window resets */
  resetAt: number;
  blocked: boolean;
}

type Listener = (s: RateLimitStatus | null) => void;

const listeners = new Set<Listener>();
let current: RateLimitStatus | null = null;
let clearTimer: ReturnType<typeof setTimeout> | undefined;

function emit(next: RateLimitStatus | null) {
  current = next;
  listeners.forEach((l) => l(current));
}

/** Parse `"name"; r=12; t=34` -> { r: 12, t: 34 } */
function parseDraft8(header: string): { r?: number; t?: number; q?: number } {
  const out: { r?: number; t?: number; q?: number } = {};
  for (const m of header.matchAll(/\b([rtq])\s*=\s*(\d+)/g)) {
    out[m[1] as "r" | "t" | "q"] = parseInt(m[2], 10);
  }
  return out;
}

function observeResponse(url: string, response: Response) {
  try {
    if (!url.includes("/api/")) return;
    const rl = response.headers.get("RateLimit");
    if (!rl) return;
    const { r, t } = parseDraft8(rl);
    if (r == null) return;
    const policy = response.headers.get("RateLimit-Policy");
    const q = policy ? parseDraft8(policy).q ?? null : null;
    const resetSec = t ?? 60;
    const status: RateLimitStatus = {
      remaining: r,
      limit: q,
      resetAt: Date.now() + resetSec * 1000,
      blocked: response.status === 429,
    };
    emit(status);
    // Auto-clear shortly after the window resets — quota is back to full.
    if (clearTimer) clearTimeout(clearTimer);
    clearTimer = setTimeout(() => emit(null), (resetSec + 1) * 1000);
  } catch {
    // Never let monitoring break the actual request path.
  }
}

declare global {
  interface Window {
    __aiRateLimitMonitorInstalled?: boolean;
  }
}

export function installRateLimitMonitor(): void {
  if (typeof window === "undefined" || window.__aiRateLimitMonitorInstalled) return;
  window.__aiRateLimitMonitorInstalled = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await originalFetch(input, init);
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    observeResponse(url, response);
    return response;
  };
}

export function subscribeRateLimit(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}

// Install at module import time so requests fired by components that mount
// before the banner (or before its effect runs) are still observed.
installRateLimitMonitor();

/** Show the banner once remaining requests drop to this number or below. */
const WARN_THRESHOLD = 10;

export function RateLimitBanner() {
  const [status, setStatus] = useState<RateLimitStatus | null>(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    installRateLimitMonitor();
    return subscribeRateLimit(setStatus);
  }, []);

  // Re-render every few seconds while visible so the reset countdown stays fresh.
  useEffect(() => {
    if (!status) return;
    const id = setInterval(() => forceTick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, [status]);

  if (!status) return null;
  if (!status.blocked && status.remaining > WARN_THRESHOLD) return null;

  const secondsLeft = Math.max(0, Math.ceil((status.resetAt - Date.now()) / 1000));
  const blocked = status.blocked || status.remaining <= 0;

  return (
    <div
      data-testid="banner-ai-rate-limit"
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 96,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        maxWidth: "92vw",
        padding: "8px 16px",
        borderRadius: 9999,
        fontSize: 13,
        lineHeight: 1.4,
        fontWeight: 500,
        boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
        pointerEvents: "none",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        color: "#fff",
        background: blocked ? "#b91c1c" : "#b45309",
      }}
    >
      {blocked ? (
        <span data-testid="text-ai-rate-limit-blocked">
          AI request limit reached. Please wait {secondsLeft}s before trying again.
        </span>
      ) : (
        <span data-testid="text-ai-rate-limit-remaining">
          {status.remaining} AI request{status.remaining === 1 ? "" : "s"} left
          {status.limit ? ` (of ${status.limit})` : ""} — resets in {secondsLeft}s.
        </span>
      )}
    </div>
  );
}
