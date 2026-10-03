// Gmail integration via standard Google APIs (Service Account / OAuth2)
// Sends transactional emails (access codes, admin notifications).

import { google } from 'googleapis';
import { logger } from "./logger";

/**
 * Sends an alert to the configurable ALERT_WEBHOOK_URL (if set) as a JSON POST.
 */
export async function sendWebhookAlert(payload: {
  subject: string;
  html: string;
  detectedAt: string;
  server: string;
}): Promise<boolean> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.info("ALERT_WEBHOOK_URL not configured — skipping webhook fallback.");
    return false;
  }

  try {
    const body = JSON.stringify({
      subject: payload.subject,
      message: payload.subject,
      html: payload.html,
      detectedAt: payload.detectedAt,
      server: payload.server,
    });

    logger.info("Attempting webhook alert fallback...");

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      await res.text().catch(() => "");
      logger.error(
        { status: res.status },
        "Webhook alert fallback returned non-2xx status",
      );
      return false;
    }

    logger.info({ status: res.status }, "Webhook alert fallback succeeded.");
    return true;
  } catch {
    logger.error("Error sending webhook alert fallback");
    return false;
  }
}

// Initialize standard Google Gmail client
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly'],
});

const gmail = google.gmail({ version: 'v1', auth });

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function encodeSubject(subject: string): string {
  return `=?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`;
}

export async function getOwnerEmail(): Promise<string | null> {
  try {
    const res = await gmail.users.getProfile({ userId: 'me' });
    return res.data.emailAddress ?? null;
  } catch {
    logger.error("Error fetching Gmail profile");
    return null;
  }
}

const SEND_RETRY_DELAYS_MS = [0, 5000, 15000];

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const { to, subject, html } = options;
  const mime = [
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(html, "utf-8").toString("base64"),
  ].join("\r\n");

  for (let attempt = 0; attempt < SEND_RETRY_DELAYS_MS.length; attempt++) {
    if (SEND_RETRY_DELAYS_MS[attempt]! > 0) {
      await new Promise((resolve) => setTimeout(resolve, SEND_RETRY_DELAYS_MS[attempt]));
    }
    const lastAttempt = attempt === SEND_RETRY_DELAYS_MS.length - 1;
    try {
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: base64UrlEncode(mime),
        },
      });
      logger.info({ to, subject }, "Email sent via Gmail");
      return true;
    } catch (error: any) {
      const status = error?.status || 500;
      logger.error(
        { status, attempt: attempt + 1, willRetry: !lastAttempt },
        "Error sending email via Gmail",
      );
      if (status !== 429 && status < 500) return false;
    }
  }
  return false;
}