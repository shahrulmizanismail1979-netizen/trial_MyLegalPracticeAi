import { Router, type IRouter } from "express";
import { db, appStatsTable } from "@workspace/db";

const router: IRouter = Router();

const KNOWN_APPS = [
  "MyLitAI",
  "MySyalitAI",
  "MyCorpAI",
  "MyConveyAI",
  "MyCrimAI",
  "MyCorpCommBankLitAi",
  "MyAccidentAi",
];

/** Fallback subscriber counts used when the admin has not yet entered real data.
 *  If a row exists in the DB (even with count 0), that value is honoured —
 *  fallbacks only apply to missing rows. */
const FALLBACK_COUNTS: Record<string, number> = {
  MyLitAI: 351,
  MySyalitAI: 132,
  MyCorpAI: 220,
  MyConveyAI: 194,
  MyCrimAI: 161,
  MyCorpCommBankLitAi: 101,
  MyAccidentAi: 209,
};

router.get("/stats/subscribers-by-app", async (_req, res): Promise<void> => {
  const rows = await db.select().from(appStatsTable);
  const rowMap = new Map(rows.map((r) => [r.appName, r.subscriberCount]));

  const result = KNOWN_APPS.map((appName) => ({
    appName,
    // If a row exists (even count 0), use it. Otherwise use fallback default.
    count: rowMap.has(appName) ? rowMap.get(appName)! : (FALLBACK_COUNTS[appName] ?? 0),
  }));

  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.json(result);
});

export default router;
