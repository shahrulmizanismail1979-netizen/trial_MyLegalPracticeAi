import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import request from "supertest";

type PortalSessionParams = Record<string, any>;

const RUN_ID = randomUUID();
const ACCESS_CODE = `MLPA-PORTL-${RUN_ID.slice(0, 5).toUpperCase()}`;
const EMAIL = `portal-${RUN_ID}@example.test`;
const STRIPE_CUSTOMER_ID = `cus_${RUN_ID.replaceAll("-", "")}`;
const STRIPE_SUBSCRIPTION_ID = `sub_${RUN_ID.replaceAll("-", "")}`;

const state = vi.hoisted(() => ({
  portalSessions: [] as PortalSessionParams[],
}));

vi.mock("../stripeClient", () => ({
  getStripeSync: vi.fn().mockRejectedValue(new Error("not used in this test")),
  getStripeMode: vi.fn().mockReturnValue("test"),
  getUncachableStripeClient: vi.fn().mockResolvedValue({
    billingPortal: {
      sessions: {
        create: vi.fn().mockImplementation(async (params: PortalSessionParams) => {
          state.portalSessions.push(params);
          return { url: "https://billing.stripe.test/session" };
        }),
      },
    },
  }),
}));

const { default: app } = await import("../app");
const { db, subscribersTable } = await import("@workspace/db");
const { eq } = await import("drizzle-orm");

describe("POST /api/stripe/customer-portal", () => {
  beforeEach(() => {
    state.portalSessions.length = 0;
    delete process.env.LAWYES_PUBLIC_URL;
    process.env.REPLIT_DOMAINS = "lawyes.example.test";
  });

  afterEach(() => {
    delete process.env.LAWYES_PUBLIC_URL;
  });

  afterAll(async () => {
    await db.delete(subscribersTable).where(eq(subscribersTable.accessCode, ACCESS_CODE));
  });

  it("opens the customer's Stripe billing portal after matching code and email", async () => {
    await db
      .insert(subscribersTable)
      .values({
        name: "Portal Test",
        email: EMAIL,
        phone: "",
        apps: ["MyLitAI"],
        paymentStatus: "confirmed",
        paymentAmount: "25.00",
        paymentProvider: "stripe",
        accessCode: ACCESS_CODE,
        stripeCustomerId: STRIPE_CUSTOMER_ID,
        stripeSubscriptionId: STRIPE_SUBSCRIPTION_ID,
      })
      .onConflictDoNothing();

    const response = await request(app).post("/api/stripe/customer-portal").send({
      accessCode: ACCESS_CODE.toLowerCase(),
      email: EMAIL.toUpperCase(),
      action: "manage",
      returnUrl: "https://attacker.example/",
    });

    expect(response.status).toBe(200);
    expect(response.body.url).toBe("https://billing.stripe.test/session");
    expect(state.portalSessions).toEqual([
      {
        customer: STRIPE_CUSTOMER_ID,
        return_url: "https://lawyes.example.test/manage-subscription",
      },
    ]);
  });

  it("opens Stripe's direct cancellation confirmation for the owned subscription", async () => {
    const response = await request(app).post("/api/stripe/customer-portal").send({
      accessCode: ACCESS_CODE,
      email: EMAIL,
      action: "cancel",
    });

    expect(response.status).toBe(200);
    expect(state.portalSessions[0]).toMatchObject({
      customer: STRIPE_CUSTOMER_ID,
      return_url: "https://lawyes.example.test/manage-subscription",
      flow_data: {
        type: "subscription_cancel",
        subscription_cancel: { subscription: STRIPE_SUBSCRIPTION_ID },
        after_completion: {
          type: "redirect",
          redirect: {
            return_url: "https://lawyes.example.test/manage-subscription?status=cancelled",
          },
        },
      },
    });
  });

  it("uses the explicitly configured public LAWYes URL over a runtime preview domain", async () => {
    process.env.LAWYES_PUBLIC_URL = "https://mylegalpracticeai.life/";

    const response = await request(app).post("/api/stripe/customer-portal").send({
      accessCode: ACCESS_CODE,
      email: EMAIL,
      action: "manage",
    });

    expect(response.status).toBe(200);
    expect(state.portalSessions).toEqual([
      expect.objectContaining({
        customer: STRIPE_CUSTOMER_ID,
        return_url: "https://mylegalpracticeai.life/manage-subscription",
      }),
    ]);
  });

  it("returns the same neutral error for a wrong code or wrong email", async () => {
    const wrongCode = await request(app).post("/api/stripe/customer-portal").send({
      accessCode: "MLPA-WRONG-WRONG",
      email: EMAIL,
    });
    const wrongEmail = await request(app).post("/api/stripe/customer-portal").send({
      accessCode: ACCESS_CODE,
      email: "wrong@example.test",
    });

    expect(wrongCode.status).toBe(400);
    expect(wrongEmail.status).toBe(400);
    expect(wrongCode.body).toEqual(wrongEmail.body);
    expect(state.portalSessions).toHaveLength(0);
  });

  it("does not expose a subscriber record that has no Stripe billing account", async () => {
    const manualCode = `MLPA-MANUL-${RUN_ID.slice(0, 5).toUpperCase()}`;
    await db.insert(subscribersTable).values({
      name: "Manual Test",
      email: `manual-${EMAIL}`,
      phone: "",
      apps: ["MyLitAI"],
      paymentStatus: "confirmed",
      paymentAmount: "25.00",
      accessCode: manualCode,
    });

    const response = await request(app).post("/api/stripe/customer-portal").send({
      accessCode: manualCode,
      email: `manual-${EMAIL}`,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("couldn't verify");
    expect(state.portalSessions).toHaveLength(0);

    await db.delete(subscribersTable).where(eq(subscribersTable.accessCode, manualCode));
  });
});