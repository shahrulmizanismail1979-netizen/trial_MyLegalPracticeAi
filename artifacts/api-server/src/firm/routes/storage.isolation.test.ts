import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const state = vi.hoisted(() => ({
  workspaceId: 0,
  requestPath: "",
  grants: new Map<string, number>(),
  opened: [] as string[],
  pending: [] as Array<{
    id: number;
    portal: string;
    owner: string;
    purpose: string;
    path: string;
    expiresAt: number;
  }>,
}));

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  const query = async (text: string, params: unknown[] = []) => {
    if (text === "BEGIN" || text === "COMMIT" || text === "ROLLBACK" || text.includes("pg_advisory_xact_lock")) {
      return { rows: [], rowCount: null };
    }
    if (text.includes("SELECT count(*)")) {
      const [portal, owner, purpose] = params as string[];
      const count = state.pending.filter(
        (row) =>
          row.portal === portal &&
          row.owner === owner &&
          row.purpose === purpose &&
          row.expiresAt > Date.now(),
      ).length;
      return { rows: [{ pending_count: String(count) }], rowCount: 1 };
    }
    if (text.includes("INSERT INTO case_pending_uploads")) {
      const [portal, owner, path, purpose] = params as string[];
      if (state.pending.some((row) => row.path === path)) {
        return { rows: [], rowCount: 0 };
      }
      state.pending.push({
        id: state.pending.length + 1,
        portal,
        owner,
        path,
        purpose,
        expiresAt: Date.now() + 30 * 60_000,
      });
      return { rows: [], rowCount: 1 };
    }
    if (text.includes("DELETE FROM case_pending_uploads")) {
      const [portal, owner, purpose] = params as string[];
      state.pending = state.pending.filter(
        (row) =>
          !(
            row.portal === portal &&
            row.owner === owner &&
            row.purpose === purpose &&
            row.expiresAt <= Date.now()
          ),
      );
      return { rows: [], rowCount: 0 };
    }
    throw new Error(`Unexpected upload registry query: ${text}`);
  };
  const client = { query, release: vi.fn() };
  return {
    ...actual,
    pool: {
      query,
      connect: async () => client,
    },
  };
});

vi.mock("../db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db")>();
  return {
    ...actual,
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () =>
              state.grants.get(state.requestPath) === state.workspaceId
                ? [{ id: 1 }]
                : [],
          }),
        }),
      }),
    },
  };
});

vi.mock("../lib/objectStorage", () => {
  class ObjectNotFoundError extends Error {}
  class ObjectStorageService {
    async getObjectEntityFile(objectPath: string) {
      state.opened.push(objectPath);
      return { objectPath };
    }
    async downloadObject() {
      return new Response("workspace-file", {
        headers: { "Content-Type": "text/plain" },
      });
    }
  }
  return { ObjectNotFoundError, ObjectStorageService };
});

const { runWithFirmWorkspace } = await import("../lib/workspace");
const { default: storageRouter } = await import("./storage");
const {
  createFirmUploadObjectName,
  isFirmUploadObjectPath,
} = await import("../lib/storageTokens");
const uploadTracker = await import("../lib/uploadTracker");

function grantTransaction() {
  const dialect = new PgDialect();
  return {
    async execute(statement: SQL) {
      const query = dialect.sqlToQuery(statement);
      const [portal, owner, purpose, path] = query.params as string[];
      const index = state.pending.findIndex(
        (row) =>
          row.portal === portal &&
          row.owner === owner &&
          row.purpose === purpose &&
          row.path === path &&
          row.expiresAt > Date.now(),
      );
      if (index < 0) return { rows: [] };
      const [removed] = state.pending.splice(index, 1);
      return { rows: [{ id: removed.id }] };
    },
  };
}

function testApp(workspaceId: number) {
  const app = express();
  app.use((req, _res, next) => {
    state.workspaceId = workspaceId;
    state.requestPath = req.path.replace(/^\/storage/, "");
    runWithFirmWorkspace(workspaceId, next);
  });
  app.use(storageRouter);
  return app;
}

describe("firm object route workspace boundary", () => {
  beforeEach(() => {
    process.env.FIRM_STORAGE_TOKEN_SECRET = "firm-storage-isolation-test-secret";
    state.grants.clear();
    state.opened = [];
    state.pending = [];
  });

  it("binds upload capability paths to exactly one workspace", () => {
    const name = createFirmUploadObjectName(
      11,
      "00000000-0000-0000-0000-000000000001",
    );
    const path = `/objects/${name}`;

    expect(isFirmUploadObjectPath(path, 11)).toBe(true);
    expect(isFirmUploadObjectPath(path, 22)).toBe(false);
    expect(isFirmUploadObjectPath(`${path}tampered`, 11)).toBe(false);
  });

  it("serves an evidence object registered in the current workspace", async () => {
    const path = "/objects/firm/11/uploads/00000000-0000-0000-0000-000000000001.sig";
    state.grants.set(path, 11);

    const response = await request(testApp(11)).get(`/storage${path}`);

    expect(response.status).toBe(200);
    expect(response.text).toBe("workspace-file");
    expect(state.opened).toEqual([path]);
  });

  it("does not open a known object registered to another workspace", async () => {
    const path = "/objects/firm/11/uploads/00000000-0000-0000-0000-000000000001.sig";
    state.grants.set(path, 11);

    const response = await request(testApp(22)).get(`/storage${path}`);

    expect(response.status).toBe(404);
    expect(state.opened).toEqual([]);
  });

  it("does not treat an arbitrary unregistered object path as a bearer grant", async () => {
    const path = "/objects/firm/22/uploads/00000000-0000-0000-0000-000000000002.sig";

    const response = await request(testApp(22)).get(`/storage${path}`);

    expect(response.status).toBe(404);
    expect(state.opened).toEqual([]);
  });
});

describe("firm persistent upload grants", () => {
  beforeEach(() => {
    state.pending = [];
  });

  it("survives a module restart because the grant is stored in the database", async () => {
    const path = "/objects/firm/11/uploads/restart.fixture";
    expect(await uploadTracker.trackPendingUpload(11, 7, path)).toBe(true);

    vi.resetModules();
    const restartedTracker = await import("../lib/uploadTracker");

    expect(await restartedTracker.getPendingCount(11, 7)).toBe(1);
  });

  it("rejects foreign owners, expired grants, and grant reuse", async () => {
    const path = "/objects/firm/11/uploads/single-use.fixture";
    await uploadTracker.trackPendingUpload(11, 7, path);
    const tx = grantTransaction();

    expect(await uploadTracker.markUploadClaimed(tx, 11, 8, path)).toBe(false);
    expect(await uploadTracker.markUploadClaimed(tx, 11, 7, `${path}-foreign`)).toBe(false);

    state.pending[0].expiresAt = Date.now() - 1;
    expect(await uploadTracker.markUploadClaimed(tx, 11, 7, path)).toBe(false);

    state.pending[0].expiresAt = Date.now() + 60_000;
    expect(await uploadTracker.markUploadClaimed(tx, 11, 7, path)).toBe(true);
    expect(await uploadTracker.markUploadClaimed(tx, 11, 7, path)).toBe(false);
  });

  it("retains the grant when the evidence insert transaction rolls back", async () => {
    const path = "/objects/firm/11/uploads/rollback.fixture";
    await uploadTracker.trackPendingUpload(11, 7, path);
    const before = state.pending.map((row) => ({ ...row }));

    await expect(
      (async () => {
        try {
          await uploadTracker.markUploadClaimed(grantTransaction(), 11, 7, path);
          throw new Error("evidence insert failed");
        } catch (error) {
          state.pending = before;
          throw error;
        }
      })(),
    ).rejects.toThrow("evidence insert failed");

    expect(await uploadTracker.getPendingCount(11, 7)).toBe(1);
  });
});