/**
 * Tests for sendWebhookAlert (mailer.ts).
 *
 * Verifies that:
 *  - When ALERT_WEBHOOK_URL is not set the function returns false and does not crash.
 *  - When the webhook endpoint returns 2xx the function returns true.
 *  - When the webhook endpoint returns non-2xx the function returns false.
 *  - When fetch itself throws the function returns false without re-throwing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendWebhookAlert } from "./mailer";

const SAMPLE_PAYLOAD = {
  subject: "🚨 CRITICAL: Stripe is in TEST mode on production",
  html: "<p>test alert</p>",
  detectedAt: new Date().toISOString(),
  server: "test-server",
};

describe("sendWebhookAlert", () => {
  let savedWebhookUrl: string | undefined;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    savedWebhookUrl = process.env.ALERT_WEBHOOK_URL;
    // Spy on the global fetch so no real HTTP calls are made.
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    if (savedWebhookUrl === undefined) {
      delete process.env.ALERT_WEBHOOK_URL;
    } else {
      process.env.ALERT_WEBHOOK_URL = savedWebhookUrl;
    }
    vi.restoreAllMocks();
  });

  it("returns false and does not crash when ALERT_WEBHOOK_URL is not set", async () => {
    delete process.env.ALERT_WEBHOOK_URL;

    const result = await sendWebhookAlert(SAMPLE_PAYLOAD);

    expect(result).toBe(false);
    // fetch must never be called — no URL to call.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns true when the webhook endpoint responds with 2xx", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://hooks.example.com/alert";

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const result = await sendWebhookAlert(SAMPLE_PAYLOAD);

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://hooks.example.com/alert");
    expect(init.method).toBe("POST");

    const body = JSON.parse(init.body as string);
    expect(body.subject).toBe(SAMPLE_PAYLOAD.subject);
    expect(body.detectedAt).toBe(SAMPLE_PAYLOAD.detectedAt);
    expect(body.server).toBe(SAMPLE_PAYLOAD.server);
  });

  it("returns false when the webhook endpoint responds with non-2xx", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://hooks.example.com/alert";

    fetchSpy.mockResolvedValueOnce(
      new Response("Service Unavailable", { status: 503 }),
    );

    const result = await sendWebhookAlert(SAMPLE_PAYLOAD);

    expect(result).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns false and does not re-throw when fetch itself throws", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://hooks.example.com/alert";

    fetchSpy.mockRejectedValueOnce(new Error("network error"));

    const result = await sendWebhookAlert(SAMPLE_PAYLOAD);

    expect(result).toBe(false);
  });
});
