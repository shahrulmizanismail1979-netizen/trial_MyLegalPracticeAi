/**
 * Complements caseHome.open.test.ts; never replace its deliberately permissive
 * temporary tables. These fixtures use the actual Drizzle schemas and database
 * constraints, including owner parents, defaults and foreign keys.
 *
 * Only the object-storage boundary and authenticated identity are supplied by
 * the test. Upload grants/confirmation and owned-matter reads use real routes
 * and SQL. Each case uses one connection and always rolls back ALL its writes,
 * including failed setup and the upload route's opportunistic grant cleanup.
 */
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { drizzle } from "drizzle-orm/node-postgres";
import { pool } from "@workspace/db";
import {
  accessCodesTable, accMatters, accSavedWork,
  litAccessCodes, litMatters, litSavedWork,
  usersTable, conveyMatters, conveySavedWork,
} from "@workspace/db/schema";
import {
  accessCodesTable as syaAccessCodes,
  usersTable as syaUsers,
  syaMattersTable, syaSavedWorkTable,
} from "@workspace/db/sya";
import type { Portal } from "./caseStages";

const storage = vi.hoisted(() => ({
  files: new Map<string, Uint8Array>(),
}));
vi.mock("./objectStorage", () => {
  class ObjectNotFoundError extends Error {}
  return {
    ObjectNotFoundError,
    ObjectStorageService: class {
      async getObjectEntityUploadURL() {
        return `https://storage.example.test/objects/${randomUUID()}`;
      }
      normalizeObjectEntityPath(url: string) {
        return new URL(url).pathname;
      }
      async getObjectEntityFile(path: string) {
        const bytes = storage.files.get(path);
        if (!bytes) throw new ObjectNotFoundError();
        return {
          path,
          getMetadata: async () => [{
            size: String(bytes.byteLength),
            contentType: "application/octet-stream",
          }],
        };
      }
      async downloadObject(file: { path: string }) {
        return new Response(storage.files.get(file.path));
      }
    },
  };
});

const { attachDocumentVault } = await import("./caseDocuments");
const { attachCaseHome } = await import("./caseHome");
const { verifyMatterOwnership } = await import("./caseOwnership");

type FixtureDb = ReturnType<typeof drizzle>;
type Fixture = { ownerKey: string; matterId: number; workId: number };
type Model = {
  name: string;
  portal: Portal;
  seed: (db: FixtureDb, marker: string, content: string) => Promise<Fixture>;
};

// Schema-backed fixture creation intentionally names every required field, but
// leaves IDs, timestamps and optional fields to the real schema's defaults.
const models: Model[] = [
  {
    name: "access_code_id (lit; also used by crim/corp/ccb)",
    portal: "lit",
    async seed(db, marker, content) {
      const [owner] = await db.insert(litAccessCodes).values({
        code: marker, recipientName: marker, recipientEmail: `${marker}@example.test`,
      }).returning();
      const [matter] = await db.insert(litMatters).values({
        accessCodeId: owner.id, title: marker,
      }).returning();
      const [work] = await db.insert(litSavedWork).values({
        accessCodeId: owner.id, matterId: matter.id, kind: "draft", title: marker, content,
      }).returning();
      return { ownerKey: String(owner.id), matterId: matter.id, workId: work.id };
    },
  },
  {
    name: "user_id (convey)",
    portal: "convey",
    async seed(db, marker, content) {
      const [owner] = await db.insert(usersTable).values({
        accessCode: marker, displayName: marker,
      }).returning();
      const [matter] = await db.insert(conveyMatters).values({
        ownerId: owner.id, title: marker,
      }).returning();
      const [work] = await db.insert(conveySavedWork).values({
        ownerId: owner.id, matterId: matter.id, kind: "draft", title: marker, content,
      }).returning();
      return { ownerKey: String(owner.id), matterId: matter.id, workId: work.id };
    },
  },
  {
    name: "owner_id (acc)",
    portal: "acc",
    async seed(db, marker, content) {
      const [owner] = await db.insert(accessCodesTable).values({
        code: marker, label: marker,
      }).returning();
      const [matter] = await db.insert(accMatters).values({
        ownerId: owner.id, title: marker,
      }).returning();
      const [work] = await db.insert(accSavedWork).values({
        ownerId: owner.id, matterId: matter.id, kind: "draft", title: marker, content,
      }).returning();
      return { ownerKey: String(owner.id), matterId: matter.id, workId: work.id };
    },
  },
  ...(["code", "email"] as const).map((ownerType): Model => ({
    name: `owner_type + owner_id (sya ${ownerType})`,
    portal: "sya",
    async seed(db, marker, content) {
      const [owner] = ownerType === "code"
        ? await db.insert(syaAccessCodes).values({ code: marker, name: marker }).returning()
        : await db.insert(syaUsers).values({
          email: `${marker}@example.test`, name: marker, passwordHash: "not-a-login-hash",
        }).returning();
      const [matter] = await db.insert(syaMattersTable).values({
        ownerType, ownerId: owner.id, title: marker,
      }).returning();
      const [work] = await db.insert(syaSavedWorkTable).values({
        ownerType, ownerId: owner.id, matterId: matter.id,
        kind: "draft", title: marker, content,
      }).returning();
      return { ownerKey: `${ownerType}:${owner.id}`, matterId: matter.id, workId: work.id };
    },
  })),
];

describe.each(models)("schema-backed matter files — $name", ({ portal, seed }) => {
  it("creates an output and confirms a source, then opens their exact bytes", async () => {
    const marker = `rail-schema-${randomUUID()}`;
    const content = `Output ${marker}\nNon-ASCII text: café — حجة\n`;
    const sourceBytes = Uint8Array.from([0, 255, 128, 10, 13, 65, 0, 254]);
    const client = await pool.connect();
    let querySpy: { mockRestore(): void } | undefined;
    try {
      await client.query("BEGIN");
      // Do not shadow or create tables: schema drift must fail this regression.
      await client.query("SET LOCAL search_path TO public");
      querySpy = vi.spyOn(pool, "query").mockImplementation(
        client.query.bind(client) as typeof pool.query,
      );
      const { ownerKey, matterId, workId } = await seed(drizzle(client), marker, content);
      const app = express();
      app.use(express.json());
      const getOwnerKey = (req: express.Request) => req.get("x-test-owner") ?? null;
      attachDocumentVault({ router: app, portal, getOwnerKey });
      attachCaseHome({
        router: app, portal, getOwnerKey,
        getMatter: async (req, res, rawId) => {
          const id = Number(rawId);
          if (!await verifyMatterOwnership(portal, id, getOwnerKey(req) ?? "")) {
            res.status(404).json({ error: "Matter not found" });
            return undefined;
          }
          return { id };
        },
      });

      const grant = await request(app).post("/documents/upload-url")
        .set("x-test-owner", ownerKey).send({}).expect(200);
      expect(grant.body.objectPath).toMatch(/^\/objects\//);
      // Supply the presigned PUT's bytes at the external-storage boundary.
      storage.files.set(grant.body.objectPath, sourceBytes);
      const confirmed = await request(app).post("/documents/confirm")
        .set("x-test-owner", ownerKey)
        .send({
          objectPath: grant.body.objectPath, fileName: `${marker}.bin`,
          matterId, contentType: "application/octet-stream",
        }).expect(201);
      expect(confirmed.body).toMatchObject({
        portal, owner_key: ownerKey, matter_id: matterId,
        object_path: grant.body.objectPath, content_type: "application/octet-stream",
      });
      expect(Number(confirmed.body.size_bytes)).toBe(sourceBytes.byteLength);
      const pending = await client.query(
        "SELECT id FROM case_pending_uploads WHERE object_path = $1",
        [grant.body.objectPath],
      );
      expect(pending.rows).toEqual([]);

      const output = await request(app)
        .get(`/${matterId}/case-home/saved-work/${workId}/open`)
        .set("x-test-owner", ownerKey).expect(200);
      expect(Buffer.from(output.text, "utf8")).toEqual(Buffer.from(content, "utf8"));
      expect(output.headers["content-type"]).toMatch(/^text\/plain/);
      expect(output.headers["cache-control"]).toBe("private, no-store");

      const source = await request(app)
        .get(`/${matterId}/case-home/documents/${confirmed.body.id}/open`)
        .set("x-test-owner", ownerKey).expect(200);
      expect(Buffer.isBuffer(source.body)).toBe(true);
      expect(source.body).toEqual(Buffer.from(sourceBytes));
      expect(source.headers["content-disposition"]).toBe(`attachment; filename="${marker}.bin"`);
      expect(source.headers["cache-control"]).toBe("private, no-store");
      expect(source.headers["x-content-type-options"]).toBe("nosniff");
    } finally {
      try {
        await client.query("ROLLBACK");
      } finally {
        querySpy?.mockRestore();
        client.release();
        storage.files.clear();
      }
    }
  });
});