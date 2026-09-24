import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const state = vi.hoisted(() => ({
  subscribers: [] as Array<Record<string, unknown>>,
  mirrors: {} as Record<string, Array<Record<string, unknown>>>,
  queries: [] as Array<{ table: string; limit?: number; where?: unknown; order?: unknown }>,
  fail: false,
}));

vi.mock("@workspace/db", async (original) => {
  const actual = await original<typeof import("@workspace/db")>();
  return { ...actual, db: {
    select: () => ({
      from: (table: Parameters<typeof getTableName>[0]) => {
        const query: typeof state.queries[number] = { table: getTableName(table) };
        state.queries.push(query);
        const chain = {
          where: (condition: unknown) => { query.where = condition; return chain; },
          orderBy: (order: unknown) => { query.order = order; return chain; },
          limit: async (limit: number) => {
            query.limit = limit;
            if (state.fail) throw new Error("diagnostic query unavailable");
            return (query.table === "subscribers" ? state.subscribers : state.mirrors[query.table] ?? []).slice(0, limit);
          },
        };
        return chain;
      },
    }),
  }};
});
vi.mock("../../stripeClient", () => ({ getUncachableStripeClient: vi.fn() }));
vi.mock("../../lib/mailer", () => ({ sendEmail: vi.fn(), getOwnerEmail: vi.fn() }));

const { default: router } = await import("./subscribers");
const app = express();
app.use("/api/admin", router);
app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: "Portal access diagnostic unavailable" });
});

beforeEach(() => {
  state.subscribers = [];
  state.mirrors = {};
  state.queries = [];
  state.fail = false;
});

describe("bounded portal access diagnostic route (database mocked)", () => {
  it("bounds the sample, filters eligible subscribers, reports IDs only, and never writes", async () => {
    state.subscribers = Array.from({ length: 30 }, (_, index) => ({
      id: 100 - index, accessCode: "PRIVATE-CODE", name: "PRIVATE-NAME", email: "private@example.test",
      apps: ["MyCrimAI"],
    }));
    const result = await request(app).get("/api/admin/subscribers/portal-access-check");
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ sampleLimit: 25, sampled: 25, unknownIntent: 0 });
    expect(result.body.gaps).toHaveLength(25);
    expect(result.body.gaps[0]).toEqual({ subscriberId: 100, portal: "MyCrimAI" });
    expect(JSON.stringify(result.body)).not.toMatch(/PRIVATE|private@|accessCode|email/);
    expect(state.queries).toHaveLength(26);
    expect(state.queries[0]?.limit).toBe(25);
    expect(state.queries.slice(1).every(query => query.limit === 1)).toBe(true);
    const dialect = new PgDialect();
    const predicate = dialect.sqlToQuery(state.queries[0]!.where as Parameters<typeof dialect.sqlToQuery>[0]);
    expect(predicate.params).toContain("confirmed");
    expect(predicate.sql).toContain("subscription_expiry");
    expect(predicate.sql).toContain("is null");
    expect(predicate.sql).toContain(" > ");
    expect(dialect.sqlToQuery(state.queries[0]!.order as Parameters<typeof dialect.sqlToQuery>[0]).sql).toContain("desc");
  });

  it.each([
    [undefined, 1],
    [{ isActive: false }, 1],
    [{ isActive: true, expiresAt: new Date("2000-01-01") }, 1],
    [{ isActive: true, expiresAt: new Date("2099-01-01") }, 0],
    [{ isActive: true, expiresAt: null }, 0],
  ])("reports mirror health without changing it: %j", async (row, gaps) => {
    state.subscribers = [{ id: 7, accessCode: "PRIVATE", apps: ["MyCrimAI"] }];
    if (row) state.mirrors.crim_access_codes = [row];
    const result = await request(app).get("/api/admin/subscribers/portal-access-check");
    expect(result.status).toBe(200);
    expect(result.body.gaps).toHaveLength(gaps);
  });

  it.each([
    [{ active: false, expiresAt: null }, 1],
    [{ active: true, expiresAt: null }, 0],
  ])("uses the actual CCB `active` database column: %j", async (row, gaps) => {
    state.subscribers = [{ id: 8, accessCode: "PRIVATE", apps: ["MyCCBLitAI"] }];
    state.mirrors.ccb_access_codes = [row];
    const result = await request(app).get("/api/admin/subscribers/portal-access-check");
    expect(result.status).toBe(200);
    expect(result.body.gaps).toHaveLength(gaps);
  });

  it("reports unknown intent separately and detects absent subscriber credentials without mirror lookup", async () => {
    state.subscribers = [{ id: 1, apps: [], accessCode: "PRIVATE" }, { id: 2, apps: ["MyCrimAI"], accessCode: null }];
    const result = await request(app).get("/api/admin/subscribers/portal-access-check");
    expect(result.body).toEqual({ sampleLimit: 25, sampled: 2, unknownIntent: 1, gaps: [{ subscriberId: 2, portal: "MyCrimAI" }] });
    expect(state.queries).toHaveLength(1);
  });

  it("returns an explicit error rather than a healthy report on query failure", async () => {
    state.fail = true;
    const result = await request(app).get("/api/admin/subscribers/portal-access-check");
    expect(result.status).toBe(500);
    expect(result.body.error).toBeTruthy();
    expect(result.body.gaps).toBeUndefined();
  });

  it("counts unrecognized nonempty intent, while still checking recognized apps in mixed lists", async () => {
    state.subscribers = [
      { id: 1, apps: ["RetiredUnknownApp"], accessCode: "PRIVATE" },
      { id: 2, apps: ["RetiredUnknownApp", "MyCrimAI"], accessCode: "PRIVATE" },
      { id: 3, apps: [], accessCode: "PRIVATE" },
    ];
    const result = await request(app).get("/api/admin/subscribers/portal-access-check");
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      sampleLimit: 25, sampled: 3, unknownIntent: 2,
      gaps: [{ subscriberId: 2, portal: "MyCrimAI" }],
    });
    expect(state.queries).toHaveLength(2);
    expect(state.queries[1]?.table).toBe("crim_access_codes");
  });
});