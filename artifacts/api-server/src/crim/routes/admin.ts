import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db,
  crimAccessCodesTable,
  topicsTable,
  caseLawsTable,
  causePapersTable,
  workflowsTable,
  sampleDocumentsTable,
  glossaryTermsTable,
  costsFeesTable,
} from "@workspace/db";
import { generateAccessCode, releaseCode, isSessionStale } from "../lib/accessCodes";
import { requireAdmin } from "../middleware/requireAuth";
import { expandSeed } from "../lib/expand-seed";

// Fail closed: when ADMIN_PASSWORD is unset/blank, admin login is disabled.
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD ?? "").trim();

const router: IRouter = Router();

// ===== Admin auth =====
router.post("/admin/login", async (req, res): Promise<void> => {
  const password = (req.body?.password ?? "").toString();
  if (!password || password !== ADMIN_PASSWORD) {
    res.status(401).json({ ok: false, message: "Invalid admin password." });
    return;
  }
  req.session.regenerate((err) => {
    if (err) {
      req.log.error({ err }, "Failed to regenerate admin session");
      res.status(500).json({ ok: false, message: "Session error." });
      return;
    }
    (req.session as any).isAdmin = true;
    res.json({ ok: true });
  });
});

router.post("/admin/logout", async (req, res): Promise<void> => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get("/admin/session", async (req, res): Promise<void> => {
  res.json({ isAdmin: !!(req.session as any)?.isAdmin });
});

router.post("/admin/expand-seed", async (req, res): Promise<void> => {
  if (!(req.session as any)?.isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const counts = await expandSeed();
    res.json({ ok: true, counts });
  } catch (err: any) {
    req.log.error({ err }, "expand-seed failed");
    res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

// ===== Everything below requires admin =====
router.use("/admin", requireAdmin);

// ===== Access codes =====
router.get("/admin/access-codes", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(crimAccessCodesTable)
    .orderBy(desc(crimAccessCodesTable.createdAt));
  const enriched = rows.map((r) => ({
    ...r,
    inUse: !!r.currentSessionId && !isSessionStale(r.lastSeenAt),
  }));
  res.json(enriched);
});

function parseExpiresAt(raw: unknown): Date | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  const d = new Date(raw as string);
  if (isNaN(d.getTime())) return undefined;
  return d;
}

async function generateUniqueCode(): Promise<string> {
  let code = "";
  for (let i = 0; i < 5; i++) {
    code = generateAccessCode();
    const existing = await db
      .select()
      .from(crimAccessCodesTable)
      .where(eq(crimAccessCodesTable.code, code));
    if (existing.length === 0) return code;
  }
  return code;
}

router.post("/admin/access-codes", async (req, res): Promise<void> => {
  const label = (req.body?.label ?? "").toString().slice(0, 200);
  const expiresAt = parseExpiresAt(req.body?.expiresAt);
  const code = await generateUniqueCode();
  const [row] = await db
    .insert(crimAccessCodesTable)
    .values({ code, label, isActive: true, expiresAt: expiresAt ?? null })
    .returning();
  res.json(row);
});

router.post("/admin/access-codes/bulk", async (req, res): Promise<void> => {
  const count = Math.min(Math.max(Number(req.body?.count) || 0, 1), 200);
  const labelPrefix = (req.body?.labelPrefix ?? "").toString().slice(0, 180);
  const expiresAt = parseExpiresAt(req.body?.expiresAt);
  const rows = [];
  for (let i = 1; i <= count; i++) {
    const code = await generateUniqueCode();
    const label = labelPrefix ? `${labelPrefix} ${i}` : "";
    const [row] = await db
      .insert(crimAccessCodesTable)
      .values({ code, label, isActive: true, expiresAt: expiresAt ?? null })
      .returning();
    rows.push(row);
  }
  res.json({ count: rows.length, codes: rows });
});

router.patch("/admin/access-codes/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const updates: any = {};
  if (typeof req.body?.label === "string") updates.label = req.body.label.slice(0, 200);
  if (typeof req.body?.isActive === "boolean") updates.isActive = req.body.isActive;
  if ("expiresAt" in (req.body ?? {})) {
    const parsed = parseExpiresAt(req.body.expiresAt);
    if (parsed !== undefined) updates.expiresAt = parsed;
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  const [row] = await db
    .update(crimAccessCodesTable)
    .set(updates)
    .where(eq(crimAccessCodesTable.id, id))
    .returning();
  res.json(row);
});

router.post("/admin/access-codes/:id/release", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await releaseCode(id);
  res.json({ ok: true });
});

router.delete("/admin/access-codes/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(crimAccessCodesTable).where(eq(crimAccessCodesTable.id, id));
  res.json({ ok: true });
});

// ===== Generic CRUD factory with field whitelist =====
function crudRoutes(
  path: string,
  table: any,
  allowedFields: string[],
  orderField: any = null,
) {
  const pick = (body: any) => {
    const out: any = {};
    for (const f of allowedFields) {
      if (body && Object.prototype.hasOwnProperty.call(body, f)) out[f] = body[f];
    }
    return out;
  };

  router.get(`/admin/${path}`, async (_req, res): Promise<void> => {
    const rows = orderField
      ? await db.select().from(table).orderBy(orderField)
      : await db.select().from(table).orderBy(desc(table.createdAt));
    res.json(rows);
  });

  router.post(`/admin/${path}`, async (req, res): Promise<void> => {
    try {
      const inserted = (await db.insert(table).values(pick(req.body)).returning()) as any[];
      res.json(inserted[0]);
    } catch (err: any) {
      req.log.error({ err }, `Insert failed for ${path}`);
      res.status(400).json({ error: "Failed to create item. Check required fields." });
    }
  });

  router.put(`/admin/${path}/:id`, async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    try {
      const [row] = await db
        .update(table)
        .set(pick(req.body))
        .where(eq(table.id, id))
        .returning();
      res.json(row);
    } catch (err: any) {
      req.log.error({ err }, `Update failed for ${path}`);
      res.status(400).json({ error: "Failed to update item. Check required fields." });
    }
  });

  router.delete(`/admin/${path}/:id`, async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    await db.delete(table).where(eq(table.id, id));
    res.json({ ok: true });
  });
}

crudRoutes("topics", topicsTable,
  ["title", "description", "content", "category", "orderIndex"],
  topicsTable.orderIndex);
crudRoutes("case-laws", caseLawsTable,
  ["caseName", "citation", "court", "year", "summary", "keyPrinciples", "category", "fullText"]);
crudRoutes("cause-papers", causePapersTable,
  ["title", "court", "description", "templateContent", "category"]);
crudRoutes("workflows", workflowsTable,
  ["title", "description", "steps", "category", "estimatedDuration"]);
crudRoutes("sample-documents", sampleDocumentsTable,
  ["title", "description", "documentType", "content", "category"]);
crudRoutes("glossary", glossaryTermsTable,
  ["term", "definition", "malayTranslation", "relatedTerms"]);
crudRoutes("costs-fees", costsFeesTable,
  ["title", "description", "amount", "category", "courtType", "legalBasis"]);

export default router;
