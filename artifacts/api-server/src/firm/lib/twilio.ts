import { ReplitConnectors } from "@replit/connectors-sdk";

// Twilio integration (Replit connector). Basic auth is injected by the
// connectors proxy; we never read the raw auth token here. The Account SID is
// still needed because it is part of the Twilio REST URL, so we read it from
// the connection settings.
const connectors = new ReplitConnectors();

const CONNECTOR_NAME = "twilio";
const SANDBOX_FROM = "+14155238886"; // Twilio WhatsApp sandbox sender

let cachedAccountSid: string | null = null;

function extractAccountSid(conn: unknown): string | undefined {
  const c = conn as Record<string, unknown>;
  const candidates: unknown[] = [
    c?.connection_settings,
    c?.settings,
    c?.integration,
    (c?.metadata as Record<string, unknown> | undefined) ?? undefined,
    c,
  ];
  for (const src of candidates) {
    if (src && typeof src === "object") {
      const s = src as Record<string, unknown>;
      const sid = s.account_sid ?? s.accountSid ?? s.sid;
      if (typeof sid === "string" && sid.startsWith("AC")) return sid;
    }
  }
  return undefined;
}

/**
 * Resolve the Twilio Account SID from the active connection. Returns null when
 * Twilio is not connected, so callers can fall back to simulated logging.
 */
async function getAccountSid(): Promise<string | null> {
  if (cachedAccountSid) return cachedAccountSid;
  let connections: unknown[];
  try {
    connections = await connectors.listConnections({
      connector_names: CONNECTOR_NAME,
      expand: ["connection_settings"],
    });
  } catch {
    return null;
  }
  const conn = connections?.[0];
  if (!conn) return null;
  const sid = extractAccountSid(conn);
  if (!sid) return null;
  cachedAccountSid = sid;
  return sid;
}

function toE164(raw: string): string {
  const cleaned = raw.replace(/^whatsapp:/i, "").replace(/[^\d+]/g, "");
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

function toWhatsAppAddress(raw: string): string {
  return `whatsapp:${toE164(raw)}`;
}

/**
 * The WhatsApp sender. Twilio WhatsApp requires an approved sender (or the
 * sandbox number). Configurable via TWILIO_WHATSAPP_FROM; defaults to the
 * Twilio sandbox sender so reminders work out of the box during testing.
 */
function whatsAppFrom(): string {
  const raw = process.env.TWILIO_WHATSAPP_FROM?.trim() || SANDBOX_FROM;
  return toWhatsAppAddress(raw);
}

/**
 * The SMS sender. Unlike WhatsApp there is no universal sandbox number, so a
 * Twilio-owned SMS-capable number MUST be configured via TWILIO_SMS_FROM
 * (E.164). Returns null when unset so the caller logs a simulated send.
 */
function smsFrom(): string | null {
  const raw =
    process.env.TWILIO_SMS_FROM?.trim() ||
    process.env.TWILIO_PHONE_NUMBER?.trim();
  return raw ? toE164(raw) : null;
}

async function postMessage(
  accountSid: string,
  from: string,
  to: string,
  body: string,
): Promise<{ sid: string }> {
  const form = new URLSearchParams();
  form.set("From", from);
  form.set("To", to);
  form.set("Body", body);

  const res = await connectors.proxy(
    CONNECTOR_NAME,
    `/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    },
  );

  if (!res.ok) {
    // A stale cached SID could cause a 404; drop it so the next call re-resolves.
    if (res.status === 404) cachedAccountSid = null;
    const detail = await res.text().catch(() => "");
    throw new Error(`Twilio API ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as { sid?: string };
  return { sid: data.sid ?? "unknown" };
}

/**
 * Send a WhatsApp message via Twilio through the Replit connector proxy.
 * Returns the message SID on success, or null when Twilio is not connected
 * (so the caller can log a simulated send instead). Throws on a real API error.
 */
export async function sendWhatsApp(
  to: string,
  body: string,
): Promise<{ sid: string } | null> {
  const accountSid = await getAccountSid();
  if (!accountSid) return null;
  return postMessage(accountSid, whatsAppFrom(), toWhatsAppAddress(to), body);
}

/**
 * Send an SMS via Twilio through the Replit connector proxy. Returns the
 * message SID on success, or null when Twilio is not connected OR no SMS sender
 * number (TWILIO_SMS_FROM) is configured — so the caller logs a simulated send
 * instead. Throws on a real API error.
 */
export async function sendSms(
  to: string,
  body: string,
): Promise<{ sid: string } | null> {
  const accountSid = await getAccountSid();
  if (!accountSid) return null;
  const from = smsFrom();
  if (!from) return null;
  return postMessage(accountSid, from, toE164(to), body);
}
