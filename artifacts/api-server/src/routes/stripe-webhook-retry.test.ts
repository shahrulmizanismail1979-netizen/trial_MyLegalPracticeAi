import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const state = vi.hoisted(() => ({
  syncWebhook: vi.fn(),
  provisioningHook: vi.fn(),
  conveyHook: vi.fn(),
}));

vi.mock("../webhookHandlers", () => ({
  WebhookHandlers: {
    processWebhook: state.syncWebhook,
  },
}));

vi.mock("../lib/provisioning", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/provisioning")>();
  return {
    ...actual,
    handleStripeEventForProvisioning: state.provisioningHook,
  };
});

vi.mock("../lib/conveyStripe", () => ({
  handleConveyStripeEvent: state.conveyHook,
}));

const { default: app } = await import("../app");

function subscriptionDeletedEvent() {
  return JSON.stringify({
    id: "evt_retry_test",
    object: "event",
    type: "customer.subscription.deleted",
    data: {
      object: {
        id: "sub_retry_test",
        object: "subscription",
        status: "canceled",
        customer: "cus_retry_test",
        metadata: {},
      },
    },
  });
}

describe("Stripe subscription webhook retry behavior", () => {
  beforeEach(() => {
    state.syncWebhook.mockReset().mockResolvedValue(undefined);
    state.provisioningHook.mockReset().mockResolvedValue(undefined);
    state.conveyHook.mockReset().mockResolvedValue(undefined);
  });

  it("returns a retryable failure when access revocation fails", async () => {
    state.provisioningHook.mockRejectedValueOnce(new Error("temporary database failure"));

    const response = await request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", "test-signature")
      .set("content-type", "application/json")
      .send(subscriptionDeletedEvent());

    expect(response.status).toBe(500);
    expect(state.syncWebhook).toHaveBeenCalledOnce();
    expect(state.provisioningHook).toHaveBeenCalledOnce();
    expect(state.conveyHook).toHaveBeenCalledOnce();
  });

  it("acknowledges the event only after subscription side-effects succeed", async () => {
    const response = await request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", "test-signature")
      .set("content-type", "application/json")
      .send(subscriptionDeletedEvent());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true });
    expect(state.provisioningHook).toHaveBeenCalledOnce();
    expect(state.conveyHook).toHaveBeenCalledOnce();
  });
});