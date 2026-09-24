// Gmail integration via Replit connectors (google-mail connection).
// Sends transactional emails (access codes, admin notifications) from the
// owner's connected Gmail account.
import { ReplitConnectors } from "@replit/connectors-sdk";
import { logger } from "./logger";

/**
 * Sends an alert to the configurable ALERT_WEBHOOK_URL (if set) as a JSON POST.
 * Used as a secondary notification channel when the Gmail connector is unavailable.
 *
 * The payload shape is intentionally simple so it can be consumed by generic
 * webhook receivers (Slack incoming webhooks, n8n, Make, custom endpoints, etc.).
 *
 * Returns true when the webhook responded with a 2xx status, false otherwise.
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

    // Webhook URLs commonly embed bearer tokens in their path/query. Never log
    // the configured URL or fetch exception (which can echo that URL).
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

const connectors = new ReplitConnectors();

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
    const res = await connectors.proxy("google-mail", "/gmail/v1/users/me/profile", {
      method: "GET",
    });
    if (!res.ok) {
      logger.error({ status: res.status }, "Failed to fetch Gmail profile");
      return null;
    }
    const profile = (await res.json()) as { emailAddress?: string };
    return profile.emailAddress ?? null;
  } catch {
    logger.error("Error fetching Gmail profile");
    return null;
  }
}

// Retry a few times — connector credential fetches can transiently return
// 429 right after checkout when several credential lookups happen at once.
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
      const res = await connectors.proxy("google-mail", "/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: base64UrlEncode(mime) }),
      });
      if (!res.ok) {
        // Consume the body for connection reuse, but do not log it: connector
        // error bodies may echo request or authentication material.
        await res.text();
        logger.error(
          { status: res.status, attempt: attempt + 1, willRetry: !lastAttempt },
          "Gmail send failed",
        );
        // 4xx other than 429 will not succeed on retry.
        if (res.status !== 429 && res.status < 500) return false;
        continue;
      }
      logger.info({ to, subject }, "Email sent via Gmail");
      return true;
    } catch {
      logger.error(
        { attempt: attempt + 1, willRetry: !lastAttempt },
        "Error sending email via Gmail",
      );
    }
  }
  return false;
}
