import { Router, type IRouter } from "express";
import { db, appStatsTable } from "@workspace/db";

const router: IRouter = Router();

const KNOWN_APPS = [
  "MyLitAI",
  "MySyalitAI",
  "MyCorpAI",
  "MyConveyAI",
  "MyCrimAI",
  "MyCCBLitAI",
  "MyAccidentAI",
  "MyLawFirmAi",
  "MyLawAcad",
];

const LEGACY_APP_NAME_ALIASES: Record<string, string> = {
  MyCorpCommBankLitAi: "MyCCBLitAI",
  MyAccidentAi: "MyAccidentAI",
};

router.get("/stats/subscribers-by-app", async (_req, res): Promise<void> => {
  const rows = await db.select().from(appStatsTable);
  const rowMap = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const canonicalName = LEGACY_APP_NAME_ALIASES[row.appName] ?? row.appName;
    const existing = rowMap.get(canonicalName);
    // An administrator may have subsequently updated the canonical record.
    // Keep the newest record rather than counting aliases twice.
    if (!existing || row.updatedAt > existing.updatedAt) {
      rowMap.set(canonicalName, row);
    }
  }

  const result = KNOWN_APPS.map((appName) => ({
    appName,
    // Counts are only published from the admin-maintained database. Never use
    // invented fallback values in customer-facing community claims.
    count: rowMap.get(appName)?.subscriberCount ?? 0,
    updatedAt: rowMap.get(appName)?.updatedAt?.toISOString() ?? null,
  }));

  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.json(result);
});

export default router;
