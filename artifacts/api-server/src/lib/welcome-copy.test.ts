import { describe, it, expect, vi, afterAll } from "vitest";
import { randomUUID } from "node:crypto";

const RUN_ID = randomUUID();
const TEAM_SUB_ID = `sub_team_${RUN_ID}`;
const TEAM_SESSION_ID = `cs_team_${RUN_ID}`;
const SOLO_SUB_ID = `sub_solo_${RUN_ID}`;
const SOLO_SESSION_ID = `cs_solo_${RUN_ID}`;

// Two checkout sessions: a team bundle (firm-boutique) and an individual tier.
vi.mock("../stripeClient", () => {
  const sessions: Record<string, unknown> = {
    [TEAM_SESSION_ID]: {
      id: TEAM_SESSION_ID,
      status: "complete",
      mode: "subscription",
      subscription: TEAM_SUB_ID,
      customer: `cus_team_${RUN_ID}`,
      amount_total: 35500,
      metadata: { tier: "firm-boutique", trial: "false" },
      customer_details: {
        email: `welcome-copy-team-${RUN_ID}@example.test`,
        name: "Team Buyer",
        phone: null,
      },
    },
    [SOLO_SESSION_ID]: {
      id: SOLO_SESSION_ID,
      status: "complete",
      mode: "subscription",
      subscription: SOLO_SUB_ID,
      customer: `cus_solo_${RUN_ID}`,
      amount_total: 0,
      metadata: { tier: "single", trial: "true", appUrl: "https://mylitai.life" },
      customer_details: {
        email: `welcome-copy-solo-${RUN_ID}@example.test`,
        name: "Solo Buyer",
        phone: null,
      },
    },
  };
  return {
    getStripeSync: vi.fn().mockRejectedValue(new Error("not used")),
    getUncachableStripeClient: vi.fn().mockResolvedValue({
      checkout: {
        sessions: {
          retrieve: vi.fn().mockImplementation((id: string) => {
            const s = sessions[id];
            if (!s) throw new Error(`unexpected session ${id}`);
            return Promise.resolve(s);
          }),
        },
      },
    }),
  };
});

// Capture outgoing emails instead of sending them.
vi.mock("./mailer", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  getOwnerEmail: vi.fn().mockResolvedValue(null),
}));

const { provisionFromCheckoutSession, BUNDLE_TIER_CATALOG } = await import("./provisioning");
const { accessCodeSmsBody } = await import("./sms");
const { sendEmail } = await import("./mailer");
const { db, subscribersTable, activityTable } = await import("@workspace/db");
const { eq, like, or } = await import("drizzle-orm");

const sendEmailMock = vi.mocked(sendEmail);

async function customerEmailFor(email: string): Promise<{ subject: string; html: string }> {
  // Email dispatch is fire-and-forget inside provisioning — wait for it.
  return vi.waitFor(
    () => {
      const call = sendEmailMock.mock.calls.find((c) => c[0]?.to === email);
      expect(call).toBeDefined();
      return call![0] as { subject: string; html: string };
    },
    { timeout: 5000 },
  );
}

describe("team-bundle welcome email & SMS copy", () => {
  afterAll(async () => {
    await db
      .delete(subscribersTable)
      .where(
        or(
          eq(subscribersTable.stripeSubscriptionId, TEAM_SUB_ID),
          eq(subscribersTable.stripeSubscriptionId, SOLO_SUB_ID),
        ),
      );
    await db
      .delete(activityTable)
      .where(like(activityTable.description, `%welcome-copy-%${RUN_ID}%`));
  });

  it("sends the team variant with the catalog plan name and license count for firm-boutique", async () => {
    const tier = BUNDLE_TIER_CATALOG["firm-boutique"]!;
    expect(tier.licenses).toBeGreaterThan(0);

    const result = await provisionFromCheckoutSession(TEAM_SESSION_ID);
    expect(result?.accessCode).toBeTruthy();

    const email = await customerEmailFor(`welcome-copy-team-${RUN_ID}@example.test`);
    // Team variant markers
    expect(email.html).toContain(`Thank you for subscribing to the <b>${tier.name}</b>`);
    expect(email.html).toContain(`<b>Your plan:</b> ${tier.name}`);
    expect(email.html).toContain(`<b>Licensed users:</b> ${tier.licenses}`);
    expect(email.html).toContain(`up to ${tier.licenses} people`);
    expect(email.html).toContain("One code for your whole team.");
    expect(email.html).toContain(result!.accessCode);
    // Not the classic/individual copy
    expect(email.html).not.toContain("Here is your access code");
    expect(email.html).not.toContain("free trial");
  });

  it("sends the classic individual variant for a single-portal tier", async () => {
    const result = await provisionFromCheckoutSession(SOLO_SESSION_ID);
    expect(result?.accessCode).toBeTruthy();

    const email = await customerEmailFor(`welcome-copy-solo-${RUN_ID}@example.test`);
    expect(email.html).toContain("Thank you for subscribing to the 7-day free trial");
    expect(email.html).toContain("Here is your access code");
    expect(email.html).toContain(result!.accessCode);
    // No team wording leaks into the individual email
    expect(email.html).not.toContain("Licensed users");
    expect(email.html).not.toContain("One code for your whole team");
  });

  it("SMS copy switches to team wording with the catalog license count", () => {
    const tier = BUNDLE_TIER_CATALOG["firm-boutique"]!;
    const teamSms = accessCodeSmsBody({
      accessCode: "MLPA-TEST1-TEST2",
      trial: false,
      licenses: tier.licenses,
    });
    expect(teamSms).toContain("your team access code is MLPA-TEST1-TEST2");
    expect(teamSms).toContain(`One code covers all ${tier.licenses} licensed users`);

    const soloSms = accessCodeSmsBody({ accessCode: "MLPA-TEST1-TEST2", trial: true });
    expect(soloSms).toContain("your access code is MLPA-TEST1-TEST2");
    expect(soloSms).toContain("7-day free trial");
    expect(soloSms).not.toContain("team");
  });
});
