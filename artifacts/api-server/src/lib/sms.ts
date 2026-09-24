import { logger } from "./logger";
import { portalLoginLinks } from "./portal-delivery";

export type SmsResult = "sent" | "failed" | "not_configured";

/**
 * Send an SMS via Twilio.
 *
 * Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER
 * to be set as environment secrets.  If any are missing this returns
 * "not_configured" and provisioning falls back to email-only delivery.
 */
export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const client = await getTwilioSender();
  if (!client) return "not_configured";
  try {
    await client.send(to, body);
    return "sent";
  } catch (err) {
    logger.error({ err, to: maskPhone(to) }, "SMS send failed");
    return "failed";
  }
}

export function accessCodeSmsBody(params: {
  accessCode: string;
  trial: boolean;
  /** Licensed seat count for team bundles — changes the copy to team wording. */
  licenses?: number;
  apps?: readonly string[];
}): string {
  const { accessCode, trial, licenses } = params;
  const links = portalLoginLinks(params.apps ?? []);
  const login = links.length ? `Sign in: ${links.join(" ")}. ` : "";
  if (licenses != null) {
    return (
      `LAWYes: your team access code is ${accessCode}. ` +
      `One code covers all ${licenses} licensed users on every portal — share it with your team. ` +
      login + "Help: shahrulmizan@ukm.edu.my"
    );
  }
  return (
    `LAWYes: your access code is ${accessCode}. ` +
    (trial
      ? "Your 7-day free trial is active now — sign in with this code. "
      : "Your subscription is active — sign in with this code. ") +
    login + "Help: shahrulmizan@ukm.edu.my"
  );
}

function maskPhone(phone: string): string {
  return phone.length > 4 ? `${phone.slice(0, 4)}***${phone.slice(-2)}` : "***";
}

interface TwilioSender {
  send(to: string, body: string): Promise<void>;
}

/**
 * Returns a real Twilio sender when TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 * and TWILIO_FROM_NUMBER are all present, or null when any are missing
 * (causing the caller to fall back to email-only delivery).
 *
 * The client is constructed fresh on every call — do not cache it.
 */
async function getTwilioSender(): Promise<TwilioSender | null> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return null;
  }

  // Dynamic import keeps the module out of the hot path when Twilio is not configured.
  const twilio = (await import("twilio")).default;
  const client = twilio(accountSid, authToken);

  return {
    async send(to: string, body: string): Promise<void> {
      await client.messages.create({ to, from: fromNumber, body });
    },
  };
}
