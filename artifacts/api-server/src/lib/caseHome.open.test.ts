/**
 * Shared rail route integration: real PostgreSQL predicates and streamed bytes.
 * Portal authentication is supplied at the route boundary; the existing
 * caseHome.test.ts covers accident login. Temporary tables avoid touching user
 * data and deliberately permit mismatched item owners to test defence in depth.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { pool } from "@workspace/db";
import type { PoolClient } from "pg";
import type { Portal } from "./caseStages";

const storage = vi.hoisted(() => ({
  files: new Map<string, string>(),
  reads: vi.fn(),
}));
vi.mock("./objectStorage", () => {
  class ObjectNotFoundError extends Error {}
  return {
    ObjectNotFoundError,
    ObjectStorageService: class {
      async getObjectEntityFile(path: string) {
        storage.reads(path);
        if (!storage.files.has(path)) throw new ObjectNotFoundError();
        return path;
      }
      async downloadObject(path: string) {
        return new Response(storage.files.get(path), {
          // Deliberately unsafe upstream headers must not override route policy.
          headers: {
            "Content-Type": "text/html",
            "Content-Disposition": "inline",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
    },
  };
});
const { attachCaseHome } = await import("./caseHome");

const models: { portal: Portal; column: string; owner: string; others: string[] }[] = [
  { portal: "lit", column: "access_code_id", owner: "101", others: ["202"] },
  { portal: "crim", column: "access_code_id", owner: "101", others: ["202"] },
  { portal: "corp", column: "access_code_id", owner: "101", others: ["202"] },
  { portal: "ccb", column: "access_code_id", owner: "101", others: ["202"] },
  { portal: "convey", column: "user_id", owner: "101", others: ["202"] },
  { portal: "acc", column: "owner_id", owner: "101", others: ["202"] },
  // Change each composite component separately: neither alone identifies a user.
  { portal: "sya", column: "owner_id", owner: "code:101", others: ["code:202", "email:101"] },
];
let client: PoolClient | undefined;

beforeAll(async () => {
  client = await pool.connect();
  await client.query("BEGIN");
  // Connection-local tables shadow public tables only for this suite.
  await client.query(`CREATE TEMP TABLE case_documents (
    id integer PRIMARY KEY, portal text, owner_key text, matter_id integer,
    object_path text, file_name text, content_type text
  ) ON COMMIT DROP`);
  for (const { portal, column } of models) {
    await client.query(`CREATE TEMP TABLE ${portal}_saved_work (
      id integer PRIMARY KEY, matter_id integer, ${column} integer,
      ${portal === "sya" ? "owner_type text," : ""}
      title text, content text, object_path text, file_name text
    ) ON COMMIT DROP`);
  }
  vi.spyOn(pool, "query").mockImplementation(client.query.bind(client) as typeof pool.query);
});

afterAll(async () => {
  vi.restoreAllMocks();
  if (client) {
    try { await client.query("ROLLBACK"); }
    finally { client.release(); }
  }
  storage.files.clear();
});

describe.each(models)("matter rail open — $portal ($column)", (model) => {
  const { portal, column, owner, others } = model;
  const app = express();
  attachCaseHome({
    router: app,
    portal,
    getOwnerKey: (req) => req.get("x-test-owner") ?? null,
    getMatter: async (req, res, rawId) => {
      const id = Number(rawId);
      const expectedOwner = id === 1 || id === 2 ? owner : others[id - 3];
      if (!expectedOwner || req.get("x-test-owner") !== expectedOwner) {
        res.status(404).json({ error: "Matter not found" });
        return undefined;
      }
      return { id };
    },
  });

  const open = (kind: string, id: number, matter = 1, asOwner = owner) =>
    request(app).get(`/${matter}/case-home/${kind}/${id}/open`).set("x-test-owner", asOwner);

  async function expectIsolated(kind: string, id: number) {
    storage.reads.mockClear();
    expect((await open(kind, id, 2)).status).toBe(404);
    for (const [index, other] of others.entries()) {
      expect((await open(kind, id, 1, other)).status).toBe(404);
      expect((await open(kind, id, index + 3, other)).status).toBe(404);
    }
    expect(storage.reads).not.toHaveBeenCalled();
  }

  it("opens owned text output; rejects other matters and both foreign owner components", async () => {
    for (const [index, key] of [owner, ...others].entries()) {
      const parts = key.split(":");
      await client!.query(
        `INSERT INTO ${portal}_saved_work
         (id, matter_id, ${column}, ${portal === "sya" ? "owner_type," : ""} title, content)
         VALUES ($1, 1, $2, ${portal === "sya" ? "$5," : ""} $3, $4)`,
        [index + 1, Number(parts.at(-1)), "Output", `Private ${portal} ${key}`,
          ...(portal === "sya" ? [parts[0]] : [])],
      );
    }
    const response = await open("saved-work", 1);
    expect(response.status).toBe(200);
    expect(response.text).toBe(`Private ${portal} ${owner}`);
    expect(response.headers["content-type"]).toMatch(/^text\/plain/);
    expect(response.headers["content-disposition"]).toMatch(/^inline;/);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    await expectIsolated("saved-work", 1);
    // Outer matter ownership succeeds here: only the item's predicate can deny.
    for (const [index] of others.entries()) {
      expect((await open("saved-work", index + 2)).status).toBe(404);
    }
  });

  it.each([
    ["application/pdf", "inline"],
    ["text/plain", "inline"],
    ["text/html", "attachment"],
    ["image/svg+xml", "attachment"],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "attachment"],
  ])("opens owned %s source as %s and rejects foreign resources", async (mime, disposition) => {
    await client!.query("DELETE FROM case_documents");
    const path = `/test/${portal}/${mime}`;
    const bytes = `Private source ${portal} ${mime}`;
    storage.files.set(path, bytes);
    for (const [index, key] of [owner, ...others].entries()) {
      await client!.query(
        `INSERT INTO case_documents VALUES ($1, $2, $3, 1, $4, 'source', $5)`,
        [index + 1, portal, key, path, mime],
      );
    }
    // Same owner and matter, different portal: the portal predicate is essential.
    await client!.query(
      `INSERT INTO case_documents VALUES (99, $1, $2, 1, $3, 'foreign', $4)`,
      [portal === "lit" ? "crim" : "lit", owner, path, mime],
    );
    const response = await open("documents", 1);
    expect(response.status).toBe(200);
    const body = Buffer.isBuffer(response.body) ? response.body.toString() : response.text;
    expect(body).toBe(bytes);
    expect(response.headers["content-disposition"]).toBe(`${disposition}; filename="source"`);
    expect(response.headers["content-type"]).toContain(
      disposition === "inline" ? mime : "application/octet-stream",
    );
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    await expectIsolated("documents", 1);
    for (const [index] of others.entries()) {
      expect((await open("documents", index + 2)).status).toBe(404);
    }
    expect((await open("documents", 99)).status).toBe(404);
    expect(storage.reads).not.toHaveBeenCalled();
  });
});