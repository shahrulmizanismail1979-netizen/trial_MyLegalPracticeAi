import { logger } from "./logger";

export type SmsResult = "sent" | "failed" | "not_configured";

/**
 * Send an SMS via the Twilio Replit connector.
 *
 * Until the Twilio integration is connected, this returns "not_configured"
 * and provisioning falls back to email-only delivery.
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

export function accessCodeSmsBody(params: { accessCode: string; trial: boolean }): string {
  const { accessCode, trial } = params;
  return (
    `MyLegalPracticeAI: your access code is ${accessCode}. ` +
    (trial
      ? "Your 7-day free trial is active now — sign in with this code. "
      : "Your subscription is active — sign in with this code. ") +
    "Help: shahrulmizan@ukm.edu.my"
  );
}

function maskPhone(phone: string): string {
  return phone.length > 4 ? `${phone.slice(0, 4)}***${phone.slice(-2)}` : "***";
}

interface TwilioSender {
  send(to: string, body: string): Promise<void>;
}

/**
 * Placeholder until the Twilio Replit connector is authorized.
 * Once connected, this is replaced with the connector client snippet.
 */
async function getTwilioSender(): Promise<TwilioSender | null> {
  return null;
}
