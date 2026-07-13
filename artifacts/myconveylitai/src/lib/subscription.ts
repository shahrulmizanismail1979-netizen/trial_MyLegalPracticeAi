// Thin client for the subscription / billing endpoints that aren't part of the
// generated OpenAPI hooks. All calls go through the shared proxy at `/api/...`
// (origin-relative) and attach the bearer token saved at login.
import type { Tier } from './tier';

export type Interval = 'month' | 'year';
export type Currency = 'myr' | 'usd' | 'sgd' | 'gbp' | 'eur';

export interface PlanDef {
  id: Exclude<Tier, 'free'>;
  name: string;
  tagline: string;
  features: string[];
  prices: Record<Interval, Record<Currency, number>>;
}

export interface PlansResponse {
  plans: Record<Exclude<Tier, 'free'>, PlanDef>;
  currencies: Currency[];
  currencyLabels: Record<Currency, string>;
  currencySymbols: Record<Currency, string>;
}

export interface AccessUser {
  id: number;
  username?: string;
  accessCode?: string;
  email?: string;
  displayName: string;
  role: string;
  tier: Tier;
  grandfathered: boolean;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('convey_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return (data?.error as string) || res.statusText;
  } catch {
    return res.statusText;
  }
}

export async function fetchPlans(): Promise<PlansResponse> {
  const res = await fetch('/api/convey/plans');
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function fetchMe(): Promise<AccessUser> {
  const res = await fetch('/api/convey/me', { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return data.user as AccessUser;
}

export interface SignupInput {
  email: string;
  displayName?: string;
}

export interface AuthSuccess {
  success: true;
  token: string;
  // The access code is returned once at signup — it is the account's only credential.
  accessCode: string;
  user: AccessUser;
}

export async function signup(input: SignupInput): Promise<AuthSuccess> {
  const res = await fetch('/api/convey/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function createCheckout(args: {
  tier: Exclude<Tier, 'free'>;
  interval: Interval;
  currency: Currency;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const res = await fetch('/api/convey/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return data.url as string;
}

export async function openBillingPortal(returnUrl: string): Promise<string> {
  const res = await fetch('/api/convey/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ returnUrl }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return data.url as string;
}

export async function syncBilling(sessionId: string): Promise<void> {
  const res = await fetch('/api/convey/billing-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) throw new Error(await readError(res));
}

/** Firm-only AI audio narration. Returns an object URL for an <audio> element. */
export async function narrate(text: string): Promise<string> {
  const res = await fetch('/api/convey/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
