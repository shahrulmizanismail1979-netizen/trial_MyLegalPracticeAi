// Legacy access-code import: bring old standalone apps' customer codes into
// this project's per-portal tables so old users can keep logging in.
//
// POST /api/legacy-codes/import  (auth: x-admin-token = ADMIN_PASSWORD or
// MASTER_ACCESS_CODE)
//   { app: "lit"|"crim"|"corp"|"ccb"|"sya"|"accident",
//     dryRun?: boolean,
//     codes: [{ code, name?, email?, active?, expiresAt? }] }
//
// Rules (mirrors the MyConveyAI legacy import):
//   - Idempotent: existing codes are NEVER modified — only missing codes are
//     inserted (onConflictDoNothing). Re-running an import is always safe.
//   - Inactive/revoked legacy codes are imported as inactive so history is
//     preserved but login stays blocked.
import { Router, type IRouter } from "express";
import type { Request, Response, NextFunction } from "express";
import {
  db,
  accessCodesTable,
  crimAccessCodesTable,
  corpAccessCodes as corpAccessCodesTable,
  litAccessCodes as litAccessCodesTable,
  ccbAccessCodes as ccbAccessCodesTable,
} from "@workspace/db";
import { accessCodesTable as syaAccessCodesTable } from "@workspace/db/sya";
import { z } from "zod/v4";
import { logger } from "../lib/logger";
import {
  isAdminCredential,
  isAdminCredentialConfigured,
} from "../lib/masterAccess";

function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  if (!isAdminCredentialConfigured()) {
    res.status(503).json({ error: "Admin access is not configured" });
    return;
  }
  if (!isAdminCredential(req.headers["x-admin-token"])) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

const LegacyCode = z.object({
  code: z.string().trim().min(1).max(100),
  name: z.string().trim().max(200).optional(),
  email: z.string().trim().max(200).optional(),
  active: z.boolean().optional(),
  expiresAt: z.string().trim().optional(), // ISO date; empty/absent = no expiry
});

const ImportBody = z.object({
  app: z.enum(["lit", "crim", "corp", "ccb", "sya", "accident"]),
  dryRun: z.boolean().optional(),
  codes: z.array(LegacyCode).min(1).max(5000),
});

type LegacyCodeRow = z.infer<typeof LegacyCode>;

function parseExpiry(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function insertCode(app: string, row: LegacyCodeRow): Promise<boolean> {
  const active = row.active ?? true;
  const name = row.name || "Legacy import";
  const expiresAt = parseExpiry(row.expiresAt);
  switch (app) {
    case "lit": {
      const inserted = await db
        .insert(litAccessCodesTable)
        .values({
          code: row.code,
          recipientName: name,
          recipientEmail: row.email ?? "",
          status: active ? "active" : "revoked",
          expiresAt,
          notes: "Imported from legacy app",
        })
        .onConflictDoNothing({ target: litAccessCodesTable.code })
        .returning({ id: litAccessCodesTable.id });
      return inserted.length > 0;
    }
    case "crim": {
      const inserted = await db
        .insert(crimAccessCodesTable)
        .values({
          code: row.code,
          label: name,
          customerEmail: row.email || null,
          tier: "full",
          isActive: active,
          expiresAt,
        })
        .onConflictDoNothing({ target: crimAccessCodesTable.code })
        .returning({ id: crimAccessCodesTable.id });
      return inserted.length > 0;
    }
    case "corp": {
      const inserted = await db
        .insert(corpAccessCodesTable)
        .values({
          code: row.code,
          label: row.email || name,
          tier: "legacy_full",
          isActive: active,
          expiresAt,
        })
        .onConflictDoNothing({ target: corpAccessCodesTable.code })
        .returning({ id: corpAccessCodesTable.id });
      return inserted.length > 0;
    }
    case "ccb": {
      const inserted = await db
        .insert(ccbAccessCodesTable)
        .values({
          code: row.code,
          label: row.email || name,
          active,
        })
        .onConflictDoNothing({ target: ccbAccessCodesTable.code })
        .returning({ id: ccbAccessCodesTable.id });
      return inserted.length > 0;
    }
    case "sya": {
      const inserted = await db
        .insert(syaAccessCodesTable)
        .values({
          code: row.code,
          name,
          role: "practitioner",
          isActive: active,
        })
        .onConflictDoNothing({ target: syaAccessCodesTable.code })
        .returning({ id: syaAccessCodesTable.id });
      return inserted.length > 0;
    }
    case "accident": {
      const inserted = await db
        .insert(accessCodesTable)
        .values({
          code: row.code,
          label: row.email ? `${name} (${row.email})` : name,
          maxUsers: 2,
          isActive: active,
          expiresAt,
        })
        .onConflictDoNothing({ target: accessCodesTable.code })
        .returning({ id: accessCodesTable.id });
      return inserted.length > 0;
    }
    default:
      return false;
  }
}

const router: IRouter = Router();

router.post("/legacy-codes/import", requireAdminToken, async (req, res): Promise<void> => {
  const parsed = ImportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { app, codes, dryRun } = parsed.data;

  // Dedupe within the payload (last occurrence wins is irrelevant — fill-only).
  const seen = new Set<string>();
  const unique = codes.filter((c) => {
    if (seen.has(c.code)) return false;
    seen.add(c.code);
    return true;
  });

  if (dryRun) {
    res.json({ app, received: codes.length, unique: unique.length, dryRun: true });
    return;
  }

  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  for (const row of unique) {
    try {
      if (await insertCode(app, row)) inserted++;
      else skipped++;
    } catch (err) {
      errors++;
      req.log.error({ err, app, code: row.code }, "Legacy code import failed for row");
    }
  }

  logger.info({ app, received: codes.length, inserted, skipped, errors }, "Legacy code import finished");
  res.json({ app, received: codes.length, inserted, skipped, errors });
});

export default router;
